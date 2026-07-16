import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import logoSrc from '../assets/logo.png'
import AboutModal from './AboutModal'
import './FormCatastro.css'
import {
  SERVICE_ICONS,
  IconMap, IconHash, IconRoadType, IconCheck, IconLock, IconClose, IconDelete,
  IconLampPost, IconManhole, IconPin, IconLayers, IconTrash2, IconLocate,
  IconBuilding, IconAppLogo,
  IconSatellite, IconMapView, IconSync, IconWifiOff, IconWarning,
  IconClipboard, IconPencil, IconInstall, IconDraft, IconCheckCircle,
} from './Icons'
import { supabase, isConfigured } from '../lib/supabase'
import { toUTM } from '../utils/utm'
import { enqueue, getQueue, dequeue, queueSize, addConflict, addSent, markStuck, getSent, getConflicts, clearConflicts, onQueueReady } from '../utils/offlineQueue'
import { addRecent, getRecent } from '../utils/recentHistory'
import {
  TIPOS_VIALIDAD, TIPOS_PAVIMENTO,
  SERVICIOS_FULL, EQUIPAMIENTO_FULL, OPCIONES_SERVICIO,
} from '../constants/catastro'
import { relativeTime } from '../utils/relativeTime'
import { useFocusTrap } from '../utils/useFocusTrap'
import { getScoreLevel, calcSubtotals } from '../utils/scoreLevel'

const DRAFT_KEY = 'catastro_draft'

function loadDraft() {
  try { const d = localStorage.getItem(DRAFT_KEY); return d ? JSON.parse(d) : null } catch { return null }
}
function saveDraft(data) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)) } catch { /* storage unavailable */ }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* storage unavailable */ }
}

/* ── Score gauge — SVG half-arc ── */
function ScoreGauge({ value, max = 15.08 }) {
  const pct = Math.min(Math.max(value / max, 0), 1)
  const r = 38, cx = 50, cy = 52
  const len = Math.PI * r
  const color = value >= 12 ? '#15803d' : value >= 8 ? '#6366f1' : '#b45309'
  const arc  = `M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`
  return (
    <div className="score-gauge" role="img" aria-label={`Puntaje ${value.toFixed(2)} de ${max} puntos — nivel ${getScoreLevel(value)}`}>
      <svg viewBox={`0 0 100 ${cy+4}`} className="score-gauge-svg" aria-hidden="true">
        <path d={arc} fill="none" stroke="var(--border-2)" strokeWidth="9" strokeLinecap="round"/>
        <path d={arc} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${(pct*len).toFixed(2)} ${len.toFixed(2)}`}
          style={{ transition: 'stroke-dasharray .5s ease, stroke .3s' }}
        />
        <text x={cx} y={cy-10} textAnchor="middle" fontSize="15" fontWeight="800"
          fill={color} fontFamily="Inter,sans-serif">{value.toFixed(2)}</text>
        <text x={cx} y={cy+1} textAnchor="middle" fontSize="7" fill="var(--ink-4)"
          fontFamily="Inter,sans-serif">de {max} pts</text>
      </svg>
    </div>
  )
}

/* ─── Data ──────────────────────────────────────────────── */
const TILES = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
  },
}


const INFRA_TIPOS = [
  {
    key: 'luminaria', label: 'Luminaria', color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d',
    icon: <IconLampPost />, symbol: 'L',
    iconSvg: '<path d="M12 22V11"/><path d="M12 11C12 7 16 5 19 5"/><circle cx="19" cy="5" r="2" fill="white"/><path d="M5 22h14"/>',
    subtypes: [
      { key: 'poste_luz',      label: 'Poste de Luz',         symbol: 'PL', color: '#d97706',
        iconSvg: '<path d="M12 22V11"/><path d="M12 11C12 7 16 5 19 5"/><circle cx="19" cy="5" r="2" fill="white"/><path d="M5 22h14"/>' },
      { key: 'poste_telefono', label: 'Poste de Teléfono',    symbol: 'PT', color: '#6366f1',
        iconSvg: '<line x1="12" y1="3" x2="12" y2="21"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="7" y1="13" x2="17" y2="13"/>' },
      { key: 'luminaria',      label: 'Luminaria',            symbol: 'LU', color: '#f59e0b',
        iconSvg: '<path d="M9 21h6"/><path d="M10 18h4"/><path d="M12 3a5 5 0 015 5c0 2-1 3-2 4v1H9v-1c-1-1-2-2-2-4a5 5 0 015-5z"/>' },
      { key: 'todos',          label: 'Todas las anteriores', symbol: 'LA', color: '#92400e',
        iconSvg: '<line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/><line x1="18.4" y1="5.6" x2="5.6" y2="18.4"/>' },
    ],
  },
  {
    key: 'alcantarilla', label: 'Alcantarilla', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd',
    icon: <IconManhole />, symbol: 'A',
    iconSvg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
    subtypes: [
      { key: 'alcantarillado', label: 'Alcantarillado', symbol: 'AL', color: '#06b6d4',
        iconSvg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 8v8"/>' },
      { key: 'drenaje', label: 'Drenaje', symbol: 'DR', color: '#7c3aed',
        iconSvg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M8 14l4 4l4-4"/>' },
    ],
  },
  {
    key: 'inmueble', label: 'Inmueble', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5',
    icon: <IconBuilding />, symbol: 'I',
    iconSvg: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>',
    subtypes: [
      { key: 'casa_habitacional', label: 'Casa Habitacional', symbol: 'CH', color: '#16a34a',
        iconSvg: '<polyline points="3,11 12,3 21,11"/><path d="M5 11v10h5v-5h4v5h5V11"/>' },
      { key: 'nave_industrial',   label: 'Nave Industrial',   symbol: 'NI', color: '#7c3aed',
        iconSvg: '<path d="M2 22V9l10-7 10 7v13"/><path d="M9 22v-8h6v8"/><line x1="2" y1="13" x2="22" y2="13"/>' },
      { key: 'comercial',         label: 'Comercial',         symbol: 'CM', color: '#ea580c',
        iconSvg: '<path d="M3 9l1-6h16l1 6"/><path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0"/><path d="M5 22V13h14v9"/>' },
      { key: 'terreno_baldio',    label: 'Terreno Baldío',    symbol: 'TB', color: '#78716c',
        iconSvg: '<rect x="3" y="8" width="18" height="12" rx="1" stroke-dasharray="3 2"/><line x1="2" y1="21" x2="22" y2="21"/>' },
    ],
  },
  {
    key: 'agua', label: 'Agua', color: '#0ea5e9', bg: '#f0f9ff', border: '#7dd3fc',
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>), symbol: 'W',
    iconSvg: '<path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>',
    subtypes: [
      { key: 'con_agua', label: 'Sí hay agua', symbol: 'A+', color: '#0284c7',
        iconSvg: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8" stroke-width="2"/><path d="M8 12h8" stroke-width="2"/>' },
      { key: 'sin_agua', label: 'No hay agua', symbol: 'A-', color: '#0c4a6e',
        iconSvg: '<circle cx="12" cy="12" r="9"/><line x1="8" y1="14" x2="16" y2="18" stroke-width="2.5"/>' },
    ],
  },
]

function makeMarkerIcon(color, iconSvg) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin-dot" style="background:${color}"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">${iconSvg}</svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

// Precreate icons (type + subtype) so they don't recreate on every render
const INFRA_ICONS = {}
INFRA_TIPOS.forEach(t => {
  INFRA_ICONS[t.key] = makeMarkerIcon(t.color, t.iconSvg)
  t.subtypes?.forEach(st => {
    INFRA_ICONS[`${t.key}_${st.key}`] = makeMarkerIcon(st.color, st.iconSvg)
  })
})

const TOTAL_FIELDS = 3 + SERVICIOS_FULL.length + EQUIPAMIENTO_FULL.length

/* ─── Manzana Modal (numpad + sub-tramo) ────────────────── */
function ManzanaModal({ current, onConfirm, onClose }) {
  const trapRef = useFocusTrap()
  const firstKeyRef = useRef(null)
  const parts = current ? current.split('.') : ['', '']
  const [input, setInput] = useState(parts[0] || '')
  const [subPart, setSubPart] = useState(parts[1] || '')

  useEffect(() => { firstKeyRef.current?.focus() }, [])

  const num = parseInt(input)
  const validMain = input !== '' && !isNaN(num) && num >= 1 && num <= 1000
  const fullValue = validMain ? (subPart ? `${num}.${subPart}` : String(num)) : ''

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() }
      if (e.key === 'Enter' && validMain) onConfirm(fullValue)
    }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [onClose, onConfirm, validMain, fullValue])

  const press = (k) => {
    if (k === 'DEL') { setInput(p => p.slice(0, -1)); return }
    if (k === 'CLR') { setInput(''); setSubPart(''); return }
    if (input.length >= 4) return
    const next = input + k
    if (parseInt(next) > 1000) return
    setInput(next)
  }

  const keys = ['1','2','3','4','5','6','7','8','9','CLR','0','DEL']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label="Número de manzana" ref={trapRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-icon">{<IconHash />}</span>
            Número de Manzana
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
        </div>

        <div className="modal-display">
          <span className={`modal-number ${!input ? 'placeholder' : ''} ${input && !validMain ? 'invalid' : ''}`}>
            {fullValue || '—'}
          </span>
          <span className="modal-range">1 – 1000 · Calle opcional</span>
        </div>

        {input && !validMain && (
          <div className="modal-error">Ingresa un número entre 1 y 1000</div>
        )}

        <div className="numpad">
          {keys.map(k => (
            <button
              key={k}
              ref={k === '1' ? firstKeyRef : undefined}
              className={`numpad-key ${k === 'CLR' ? 'key-clear' : ''} ${k === 'DEL' ? 'key-del' : ''}`}
              onClick={() => press(k)}
            >
              {k === 'DEL' ? <IconDelete /> : k}
            </button>
          ))}
        </div>

        {validMain && (
          <div className="modal-subpart">
            <div className="modal-subpart-label">Calle alrededor de la manzana — opcional</div>
            <div className="modal-subpart-grid">
              <button
                className={`subpart-btn ${subPart === '' ? 'subpart-active' : ''}`}
                onClick={() => setSubPart('')}
              >
                Sin calle
              </button>
              {['1','2','3','4','5','6','7','8','9'].map(s => (
                <button
                  key={s}
                  className={`subpart-btn ${subPart === s ? 'subpart-active' : ''}`}
                  onClick={() => setSubPart(s)}
                >
                  .{s}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className="modal-confirm"
          disabled={!validMain}
          onClick={() => { if (validMain) onConfirm(fullValue) }}
        >
          <IconCheck /> Confirmar{fullValue ? ` manzana ${fullValue}` : ''}
        </button>
      </div>
    </div>
  )
}


/* ─── Service Row ───────────────────────────────────────── */
const ServiceRow = memo(function ServiceRow({ item, value, locked, isNext, onChange, tipoPavimento, onTipoChange }) {
  const ref = useRef(null)
  const prevLocked = useRef(locked)

  useEffect(() => {
    const was = prevLocked.current
    prevLocked.current = locked
    if (was && !locked && ref.current) {
      ref.current.classList.add('row-pulse')
      const t = setTimeout(() => ref.current?.classList.remove('row-pulse'), 700)
      return () => clearTimeout(t)
    }
  }, [locked])

  const sel = OPCIONES_SERVICIO.find(o => o.val === value)

  const KEY_MAP = { b:'B', r:'R', m:'M', n:'N', '1':'B', '2':'R', '3':'M', '4':'N' }

  return (
    <div
      ref={ref}
      className={`fc-row ${locked ? (isNext ? 'row-next' : 'row-locked') : 'row-open'} ${value ? `row-filled row-filled-${sel?.color}` : ''}`}
      onKeyDown={locked ? undefined : (e => {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        const val = KEY_MAP[e.key.toLowerCase()]
        if (val) { e.preventDefault(); onChange(item.key, val) }
      })}
    >
      <div className="row-left">
        <span className="row-icon">{SERVICE_ICONS[item.key]}</span>
        <span className="row-label">{item.label}</span>
        {value && <span className={`row-badge badge-${sel?.color}`}>{sel?.label}</span>}
      </div>

      {locked
        ? <div className="row-lock-msg"><IconLock /> {isNext ? 'Completa el campo anterior' : 'Bloqueado'}</div>
        : (
          <div className="row-opts">
            {OPCIONES_SERVICIO.map((opt) => (
              <button
                key={opt.val}
                type="button"
                className={`row-opt opt-${opt.color} ${value === opt.val ? 'opt-active' : ''}`}
                onClick={() => onChange(item.key, opt.val)}
                title={`Tecla: ${Object.keys(KEY_MAP).filter(k=>KEY_MAP[k]===opt.val).slice(0,2).join(' / ')}`}
                aria-pressed={value === opt.val}
              >
                {value === opt.val && <IconCheck />}
                {opt.label}
              </button>
            ))}
          </div>
        )
      }

      {/* Pavimento subfield — rendered only when this row is the pavimento row */}
      {item.hasTipo && value && value !== 'N' && (
        <div className="pav-subfield">
          <span className="pav-label">Tipo de pavimento <InfoTooltip text={"Material predominante:\nAD = Adoquín\nHI = Concreto hidráulico\nAS = Asfalto\nEM = Empedrado\nTE = Terracería\nTI = Tierra"} /></span>
          <div className="pav-grid">
            {TIPOS_PAVIMENTO.map(tp => (
              <button
                key={tp.code}
                type="button"
                className={`pav-btn ${tipoPavimento === tp.code ? 'active' : ''}`}
                onClick={() => onTipoChange(tp.code)}
                aria-pressed={tipoPavimento === tp.code}
              >
                <b>{tp.code}</b><span>{tp.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}, (prev, next) =>
  prev.value === next.value &&
  prev.locked === next.locked &&
  prev.isNext === next.isNext &&
  prev.tipoPavimento === next.tipoPavimento
)

/* ─── Equip Row ─────────────────────────────────────────── */
const EquipRow = memo(function EquipRow({ item, value, locked, isNext, onChange }) {
  const ref = useRef(null)
  const prevLocked = useRef(locked)

  useEffect(() => {
    const was = prevLocked.current
    prevLocked.current = locked
    if (was && !locked && ref.current) {
      ref.current.classList.add('row-pulse')
      const t = setTimeout(() => ref.current?.classList.remove('row-pulse'), 700)
      return () => clearTimeout(t)
    }
  }, [locked])

  return (
    <div
      ref={ref}
      className={`fc-row ${locked ? (isNext ? 'row-next' : 'row-locked') : 'row-open'} ${value !== '' ? (value === '1' ? 'row-filled row-filled-green' : 'row-filled row-filled-muted') : ''}`}
    >
      <div className="row-left">
        <span className="row-icon">{SERVICE_ICONS[item.key]}</span>
        <span className="row-label">{item.label}</span>
        {value !== '' && (
          <span className={`row-badge ${value === '1' ? 'badge-green' : 'badge-muted'}`}>
            {value === '1' ? 'Sí hay' : 'No hay'}
          </span>
        )}
      </div>

      {locked
        ? <div className="row-lock-msg"><IconLock /> {isNext ? 'Completa el campo anterior' : 'Bloqueado'}</div>
        : (
          <div className="row-opts">
            <button
              type="button"
              className={`row-opt opt-green ${value === '1' ? 'opt-active' : ''}`}
              onClick={() => onChange(item.key, '1')}
              aria-pressed={value === '1'}
            >
              {value === '1' && <IconCheck />} Sí hay
            </button>
            <button
              type="button"
              className={`row-opt opt-muted ${value === '0' ? 'opt-active' : ''}`}
              onClick={() => onChange(item.key, '0')}
              aria-pressed={value === '0'}
            >
              {value === '0' && <IconCheck />} No hay
            </button>
          </div>
        )
      }
    </div>
  )
}, (prev, next) =>
  prev.value === next.value &&
  prev.locked === next.locked &&
  prev.isNext === next.isNext
)

/* ─── Info Tooltip ─────────────────────────────────────── */
function InfoTooltip({ text }) {
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const ref = useRef(null)
  useEffect(() => {
    if (!pos) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setPos(null) }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [pos])
  const toggle = () => {
    if (pos) { setPos(null); return }
    const r = btnRef.current.getBoundingClientRect()
    const W = Math.min(244, window.innerWidth - 24)
    let rawLeft = r.left + r.width / 2 - W / 2
    let left = Math.max(8, Math.min(rawLeft, window.innerWidth - W - 8))
    const arrowLeft = Math.max(14, Math.min((r.left + r.width / 2) - left, W - 14))
    const above = r.top > 120
    setPos(above
      ? { left, bottom: window.innerHeight - r.top + 10, arrowLeft, dir: 'up' }
      : { left, top: r.bottom + 10, arrowLeft, dir: 'down' }
    )
  }
  return (
    <span className="info-tip" ref={ref} onClick={e => e.stopPropagation()}>
      <button ref={btnRef} type="button" className={`info-tip-btn${pos ? ' tip-open' : ''}`} onClick={toggle} aria-label="Ayuda" aria-expanded={!!pos} aria-describedby={pos ? 'fc-info-tip-text' : undefined}>?</button>
      {pos && (
        <span
          id="fc-info-tip-text"
          role="tooltip"
          className="info-tip-box"
          data-dir={pos.dir}
          style={{ position:'fixed', left:pos.left, '--arrow-left': pos.arrowLeft+'px',
            ...(pos.dir==='up' ? { bottom:pos.bottom } : { top:pos.top }) }}
        >
          <span className="info-tip-inner">
            <span className="info-tip-head">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <circle cx="5" cy="5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="5" y1="4.2" x2="5" y2="6.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="5" cy="2.8" r=".65" fill="currentColor"/>
              </svg>
              Información
            </span>
            <span className="info-tip-body">{text}</span>
          </span>
        </span>
      )}
    </span>
  )
}

/* ─── Type Picker Modal (infraestructura) ───────────────── */
function TypePickerModal({ onConfirm, onCancel }) {
  const trapRef = useFocusTrap()
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onCancel() } }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [onCancel])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label="Seleccionar tipo de infraestructura" ref={trapRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-icon"><IconLayers /></span>
            ¿Qué infraestructura?
          </div>
          <button className="modal-close" onClick={onCancel} aria-label="Cancelar"><IconClose /></button>
        </div>
        <div className="subtype-list">
          {INFRA_TIPOS.map(t => (
            <button
              key={t.key}
              type="button"
              className="subtype-item"
              style={{ '--st-color': t.color }}
              onClick={() => onConfirm(t.key)}
            >
              <span className="subtype-pin" style={{ background: t.color }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="17" height="17"
                  aria-hidden="true" dangerouslySetInnerHTML={{ __html: t.iconSvg }} />
              </span>
              <span className="subtype-item-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Subtype Modal (infraestructura) ──────────────────── */
function SubtypeModal({ tipo, onConfirm, onCancel }) {
  const trapRef = useFocusTrap()
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onCancel() } }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [onCancel])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={`Seleccionar subtipo de ${tipo.label}`} ref={trapRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-icon" style={{ color: tipo.color }}>{tipo.icon}</span>
            Tipo de {tipo.label}
          </div>
          <button className="modal-close" onClick={onCancel} aria-label="Cancelar"><IconClose /></button>
        </div>
        <div className="subtype-list">
          {tipo.subtypes.map(st => (
            <button
              key={st.key}
              className="subtype-item"
              style={{ '--st-color': st.color }}
              onClick={() => onConfirm(st.key)}
            >
              <span className="subtype-pin" style={{ background: st.color }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="17" height="17"
                  dangerouslySetInnerHTML={{ __html: st.iconSvg }} />
              </span>
              <span className="subtype-item-label">{st.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Map helpers ───────────────────────────────────────── */
function MapClickCapture({ onPlace }) {
  const placeRef = useRef(onPlace)
  useEffect(() => { placeRef.current = onPlace }, [onPlace])
  useMapEvents({
    click(e) { placeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }) }
  })
  return null
}

function FlyTo({ center }) {
  const map = useMap()
  useEffect(() => { map.setView(center, 17) }, [center, map])
  return null
}

const IXMIQUILPAN = [20.4878, -99.1533]

// Icono de referencia (ya capturado por otro)
function makeRefIcon(type) {
  const color = type === 'luminaria' ? '#f59e0b' : type === 'alcantarilla' ? '#2563eb' : type === 'agua' ? '#0ea5e9' : '#dc2626'
  return L.divIcon({
    className: '',
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};opacity:0.5;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  })
}

/* ─── Capa de referencia con clustering (imperativa, no crea un <Marker> por punto) ── */
function RefClusterLayer({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const group = L.markerClusterGroup({
      maxClusterRadius: 40,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => L.divIcon({
        html: `<div class="ref-cluster-icon">${cluster.getChildCount()}</div>`,
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    })
    points.forEach(m => {
      const marker = L.marker([m.lat, m.lng], { icon: makeRefIcon(m.type) })
      marker.bindPopup(
        `<div style="font-size:11px;line-height:1.6"><b style="color:#404040">Manzana ${m.manzana}</b><br/><span style="color:#6b6b6b;text-transform:capitalize">${m.type}${m.subtype ? ' · ' + m.subtype : ''}</span></div>`,
        { maxWidth: 160, closeButton: false }
      )
      group.addLayer(marker)
    })
    map.addLayer(group)
    return () => { map.removeLayer(group) }
  }, [map, points])
  return null
}

/* ─── Mapa Infraestructura Card ─────────────────────────── */
function MapaInfraestructura({ markers, onChange, blocked, blockReason, refMarkers = [] }) {
  const [tileLayer, setTileLayer]   = useState('osm')
  const [flyTarget, setFlyTarget]   = useState(null)
  const [locating, setLocating]     = useState(false)
  const [locError, setLocError]     = useState(false)

  // Centrar en GPS automáticamente al cargar
  useEffect(() => {
    if (blocked) return
    if (!navigator.geolocation) return
    let mounted = true
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (mounted) setFlyTarget([pos.coords.latitude, pos.coords.longitude])
      },
      () => {}, // silencioso si el usuario rechaza
      { enableHighAccuracy: true, timeout: 10000 }
    )
    return () => { mounted = false }
  }, [blocked])

  const handleLocate = () => {
    if (!navigator.geolocation) { setLocError(true); return }
    setLocating(true)
    setLocError(false)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFlyTarget([pos.coords.latitude, pos.coords.longitude])
        setLocating(false)
      },
      () => {
        setLocating(false)
        setLocError(true)
        setTimeout(() => setLocError(false), 3000)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const [pendingPos, setPendingPos]       = useState(null)
  const [pendingMarker, setPendingMarker] = useState(null)

  const handleMapClick = useCallback(({ lat, lng }) => {
    setPendingPos({ lat, lng })
  }, [])

  const handleTypeSelect = useCallback((typeKey) => {
    if (!pendingPos) return
    const m = { id: Date.now(), lat: pendingPos.lat, lng: pendingPos.lng, type: typeKey }
    setPendingPos(null)
    const tipo = INFRA_TIPOS.find(t => t.key === typeKey)
    if (tipo?.subtypes?.length) {
      setPendingMarker(m)
    } else {
      onChange(prev => [...prev, m])
    }
  }, [pendingPos, onChange])

  const confirmSubtype = (subtypeKey) => {
    if (pendingMarker) {
      onChange(prev => [...prev, { ...pendingMarker, subtype: subtypeKey }])
      setPendingMarker(null)
    }
  }

  const removeMarker = (id) => onChange(prev => prev.filter(m => m.id !== id))

  const counts = useMemo(() => INFRA_TIPOS.map(t => ({
    ...t,
    count: markers.filter(m => m.type === t.key).length,
  })), [markers])

  return (
    <div className={`mapa-card ${blocked ? 'card-blocked' : ''}`}>
      {pendingPos && (
        <TypePickerModal
          onConfirm={handleTypeSelect}
          onCancel={() => setPendingPos(null)}
        />
      )}
      {pendingMarker && (
        <SubtypeModal
          tipo={INFRA_TIPOS.find(t => t.key === pendingMarker.type)}
          onConfirm={confirmSubtype}
          onCancel={() => setPendingMarker(null)}
        />
      )}
      {/* Header */}
      <div className="mapa-card-head">
        <span className="mapa-card-icon"><IconLayers /></span>
        <div>
          <h2>Infraestructura en Mapa</h2>
          <p>{blocked ? (blockReason || 'Completa el formulario para acceder al mapa') : 'Toca el mapa para colocar un punto de infraestructura.'}</p>
          {!blocked && refMarkers.length > 0 && (
            <p className="mapa-ref-note">
              <span className="mapa-ref-dot" /> {refMarkers.length} punto{refMarkers.length !== 1 ? 's' : ''} ya registrado{refMarkers.length !== 1 ? 's' : ''} visibles como referencia
              <InfoTooltip text={"Los puntos opacos son infraestructura\nde otras manzanas ya capturadas.\nSirven solo como referencia visual.\n\nSolo puedes editar los puntos\nde color de esta manzana."} />
            </p>
          )}
        </div>
        {blocked && <span className="card-lock-icon"><IconLock /></span>}
      </div>

      {blocked && (
        <div className="mapa-blocked-overlay">
          <IconLock />
          <span>{blockReason || 'Completa las secciones anteriores para habilitar el mapa'}</span>
        </div>
      )}

      {!blocked && (<>

      {/* Cursor hint */}
      <div className="mapa-hint">
        {INFRA_TIPOS.map(t => (
          <span key={t.key} className="mapa-hint-dot" style={{ background: t.color }} />
        ))}
        Toca el mapa — elige el tipo al colocar
      </div>

      {/* Map */}
      <div className="mapa-wrap">
        <MapContainer
          center={IXMIQUILPAN}
          zoom={18}
          className="mapa-leaflet"
          aria-label="Mapa interactivo — toca para registrar infraestructura urbana"
        >
          {flyTarget && <FlyTo center={flyTarget} />}
          <TileLayer
            url={TILES[tileLayer].url}
            attribution={TILES[tileLayer].attribution}
          />
          <MapClickCapture onPlace={handleMapClick} />
          {/* Puntos ya registrados como referencia — agrupados para mejor rendimiento */}
          <RefClusterLayer points={refMarkers} />
          {markers.map(m => {
            const tipo = INFRA_TIPOS.find(t => t.key === m.type)
            return (
              <Marker
                key={m.id}
                position={[m.lat, m.lng]}
                icon={INFRA_ICONS[m.subtype ? `${m.type}_${m.subtype}` : m.type] ?? makeMarkerIcon('#666', '<circle cx="12" cy="12" r="5"/>')}
              >
                <Popup>
                  <div className="mapa-popup">
                    <strong>{tipo?.label}</strong>
                    {m.subtype && tipo?.subtypes && (() => {
                      const st = tipo.subtypes.find(s => s.key === m.subtype)
                      return st ? <span style={{ fontWeight: 600, color: st.color }}>{st.label}</span> : null
                    })()}
                    <span className="mapa-popup-coord">
                      <b>Geo:</b> {m.lat.toFixed(6)}, {m.lng.toFixed(6)}
                    </span>
                    <span className="mapa-popup-coord">
                      <b>UTM:</b> {toUTM(m.lat, m.lng).label}
                    </span>
                    <button
                      className="mapa-popup-del"
                      onClick={() => removeMarker(m.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
        <button
          type="button"
          className="mapa-tile-btn"
          onClick={() => setTileLayer(t => t === 'osm' ? 'sat' : 'osm')}
          title={tileLayer === 'osm' ? 'Cambiar a satélite' : 'Cambiar a mapa'}
          aria-label={tileLayer === 'osm' ? 'Cambiar a vista satélite' : 'Cambiar a mapa base'}
        >
          {tileLayer === 'osm' ? <><IconSatellite /> Satélite</> : <><IconMapView /> Mapa</>}
        </button>
        <button
          type="button"
          className={`mapa-locate-btn${locating ? ' mapa-locate-loading' : ''}${locError ? ' mapa-locate-error' : ''}`}
          onClick={handleLocate}
          disabled={locating}
          title="Centrar en mi ubicación"
          aria-live="polite"
          aria-label={locating ? 'Buscando ubicación GPS…' : locError ? 'Error: Sin GPS — intenta de nuevo' : 'Mi ubicación'}
        >
          <IconLocate />
          {locating ? 'Buscando…' : locError ? 'Sin GPS' : 'Mi ubicación'}
        </button>
      </div>

      {/* Marker count summary */}
      <div className="mapa-resumen">
        {counts.map(t => (
          <div key={t.key} className="mapa-resumen-item" style={{ borderColor: t.border, borderTopColor: t.color, background: t.bg }}>
            <span className="mapa-resumen-icon" style={{ color: t.color }}>{t.icon}</span>
            <span className="mapa-resumen-label">{t.label}</span>
            <span className="mapa-resumen-count" style={{ background: t.color }}>{t.count}</span>
          </div>
        ))}
      </div>

      {/* Marker list */}
      {markers.length === 0 && (
        <div className="mapa-lista-empty">Sin elementos registrados aún — toca el mapa para añadir</div>
      )}
      {markers.length > 0 && (
        <div className="mapa-lista">
          <div className="mapa-lista-head">
            <IconPin /> {markers.length} elemento{markers.length !== 1 ? 's' : ''} registrado{markers.length !== 1 ? 's' : ''}
          </div>
          <div className="mapa-lista-items">
            {markers.map((m) => {
              const tipo = INFRA_TIPOS.find(t => t.key === m.type)
              const subtipo = m.subtype ? tipo?.subtypes?.find(s => s.key === m.subtype) : null
              const badgeColor = subtipo?.color ?? tipo?.color ?? '#666'
              const badgeSymbol = subtipo?.symbol ?? tipo?.symbol ?? '?'
              return (
                <div key={m.id} className="mapa-lista-item">
                  <span
                    className="mapa-lista-badge"
                    style={{ background: badgeColor }}
                  >
                    {badgeSymbol}
                  </span>
                  <div className="mapa-lista-info">
                    <span className="mapa-lista-tipo">{tipo?.label}</span>
                    {subtipo && (
                      <span className="mapa-lista-subtype" style={{ color: subtipo.color }}>
                        {subtipo.label}
                      </span>
                    )}
                    <span className="mapa-lista-coords">
                      UTM {toUTM(m.lat, m.lng).label}
                    </span>
                    <span className="mapa-lista-coords" style={{ opacity: 0.5 }}>
                      {m.lat.toFixed(6)}, {m.lng.toFixed(6)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mapa-lista-del"
                    onClick={() => removeMarker(m.id)}
                    title="Eliminar"
                    aria-label="Eliminar punto de infraestructura"
                  >
                    <IconTrash2 />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      </>)}
    </div>
  )
}

/* ── VialDupModal — vialidad duplicada ── */
function VialDupModal({ nombreVialidad, vialDupData, onCancel, onConfirm }) {
  const trapRef = useFocusTrap()
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onCancel() } }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [onCancel])
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="vial-dup-modal" role="dialog" aria-modal="true" aria-labelledby="vial-dup-title"
        ref={trapRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div id="vial-dup-title" className="vial-dup-title">
          <IconWarning />
          Ya hay {vialDupData.length} manzana{vialDupData.length !== 1 ? 's' : ''} en <b>{nombreVialidad.trim()}</b>
        </div>
        <ul className="vial-dup-list">
          {vialDupData.map(d => (
            <li key={`${d.manzana}-${d.nombre_vialidad}`} className="vial-dup-item">
              Manzana <b>{d.manzana}</b> — {d.nombre_vialidad}
            </li>
          ))}
        </ul>
        <p style={{ fontSize: '.8rem', color: 'var(--ink-3)', margin: '0 0 1rem' }}>
          Es normal tener varias manzanas en la misma calle. ¿Deseas continuar?
        </p>
        <div className="vial-dup-actions">
          <button className="btn-cancel" autoFocus onClick={onCancel}>Cancelar</button>
          <button className="modal-confirm" onClick={onConfirm}>Continuar de todas formas</button>
        </div>
      </div>
    </div>
  )
}

/* ── SavedSummaryModal — confirmación post-envío ── */
function SavedSummaryModal({ savedSummary, isAdmin, showToast, onClose }) {
  const trapRef = useFocusTrap()
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [onClose])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="saved-summary" role="dialog" aria-modal="true" aria-label="Confirmación de registro"
        ref={trapRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className={`saved-ok-icon ${savedSummary._offline ? 'saved-icon-offline' : 'saved-icon-ok'}`}>
          {savedSummary._offline ? <IconWifiOff /> : <IconCheckCircle />}
        </div>
        <h2 className="saved-title">
          {savedSummary._updated
            ? 'Registro actualizado'
            : savedSummary._offline
              ? 'Guardado sin internet'
              : 'Registro enviado'}
        </h2>
        <p className="saved-sub">
          {savedSummary._offline
            ? 'Se subirá automáticamente al reconectarte'
            : `Manzana ${savedSummary.manzana}`}
        </p>
        {savedSummary._folio && (
          <button
            type="button"
            className="saved-folio"
            title="Toca para copiar el folio"
            onClick={() => {
              navigator.clipboard?.writeText(savedSummary._folio)
                .then(() => showToast('Folio copiado'))
                .catch(() => {})
            }}
          >{savedSummary._folio}</button>
        )}
        {isAdmin && savedSummary.total != null && (
          <div className="saved-score">
            <span className="saved-score-val">{Number(savedSummary.total).toFixed(2)}</span>
            <span className="saved-score-lbl">pts totales</span>
          </div>
        )}
        <button className="saved-summary-btn" autoFocus onClick={onClose}>
          Continuar
        </button>
      </div>
    </div>
  )
}

/* ── ProgressModal — manzanas capturadas con búsqueda ── */
function ProgressModal({ registeredManzanas, mzSearch, setMzSearch, onClose, onLoad, showToast }) {
  const trapRef = useFocusTrap()
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [onClose])

  const pendingQueue = getQueue()
  const queuedMz = pendingQueue.filter(q => !registeredManzanas.some(m => m.manzana === q.manzana))
  const allMz = [
    ...registeredManzanas,
    ...queuedMz.map(q => ({ manzana: q.manzana, tipo_vialidad: q.tipo_vialidad, nombre_vialidad: q.nombre_vialidad, _offline: true })),
  ]
  const filtered = allMz.filter(mz => {
    if (!mzSearch.trim()) return true
    const q = mzSearch.trim().toLowerCase()
    return String(mz.manzana).includes(q) || mz.nombre_vialidad?.toLowerCase().includes(q)
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="mz-progress-sheet" role="dialog" aria-modal="true" aria-label="Manzanas capturadas" ref={trapRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="mz-ps-header">
          <span>Manzanas capturadas ({allMz.length})</span>
          <button className="modal-close" aria-label="Cerrar" onClick={onClose}><IconClose /></button>
        </div>
        <div className="mz-ps-search-wrap">
          <input
            id="mz-busqueda"
            className="mz-ps-search"
            type="search"
            placeholder="Buscar manzana o vialidad…"
            aria-label="Buscar manzana o vialidad"
            value={mzSearch}
            onChange={e => setMzSearch(e.target.value)}
            autoFocus
            autoComplete="off"
          />
        </div>
        <div className="mz-ps-chips">
          {filtered.map(mz => (
            <button
              key={mz.manzana}
              className={`mz-ps-chip${mz._offline ? ' mz-ps-chip-offline' : ''}`}
              onClick={() => {
                if (mz._offline) {
                  showToast(`Manzana ${mz.manzana} pendiente de sincronizar — sincroniza primero para editar`)
                } else {
                  onLoad(mz.manzana)
                  onClose()
                }
              }}
            >
              <span className="mz-ps-num">{mz.manzana}</span>
              <span className="mz-ps-via">{TIPOS_VIALIDAD.find(t => t.code === mz.tipo_vialidad)?.label ?? mz.tipo_vialidad} {mz.nombre_vialidad}</span>
              {mz._offline && <span className="mz-ps-offline-tag">Offline</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── QueueModal — pendientes / enviados / conflictos ── */
function QueueModal({ sentList, conflicts, queueTab, setQueueTab, online, onSync, onClose }) {
  const trapRef = useFocusTrap()
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [onClose])

  const queue = getQueue()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="queue-modal" role="dialog" aria-modal="true" aria-label="Mis registros" ref={trapRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><IconClipboard /> Mis registros</div>
          <button className="modal-close" aria-label="Cerrar" onClick={onClose}><IconClose /></button>
        </div>

        <div className="queue-tabs">
          {[
            { id: 'pending',   label: 'Pendientes', count: queue.length },
            { id: 'sent',      label: 'Enviados',   count: sentList.length },
            { id: 'conflicts', label: 'Conflictos', count: conflicts.length },
          ].map(tab => (
            <button
              key={tab.id}
              className={`queue-tab${queueTab === tab.id ? ' queue-tab--active' : ''}`}
              onClick={() => setQueueTab(tab.id)}
            >
              {tab.label}
              {tab.count > 0 && <span className="queue-tab-badge">{tab.count}</span>}
            </button>
          ))}
        </div>

        {queueTab === 'pending' && (
          <div className="queue-list">
            {queue.length === 0
              ? <p className="queue-empty">Sin registros pendientes.</p>
              : queue.map(item => (
                <div key={item._qid} className={`queue-item${item._status === 'error' ? ' queue-item--error' : ''}`}>
                  <div className="queue-item-main">
                    <b>Manzana {item.manzana}</b>
                    <span>{TIPOS_VIALIDAD.find(t => t.code === item.tipo_vialidad)?.label ?? item.tipo_vialidad} {item.nombre_vialidad}</span>
                  </div>
                  <div className="queue-item-meta">
                    <span className="queue-item-folio">{item._folio ?? '—'}</span>
                    <span>{new Date(item._at).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                    {item._status === 'error'
                      ? <span className="queue-item-badge queue-item-badge--error">Error ({item._retries ?? 1} intento{(item._retries ?? 1) !== 1 ? 's' : ''})</span>
                      : <span className="queue-item-badge queue-item-badge--pending">Pendiente</span>
                    }
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {queueTab === 'sent' && (
          <div className="queue-list">
            {sentList.length === 0
              ? <p className="queue-empty">Aún no hay registros enviados.</p>
              : sentList.map(item => (
                <div key={item._folio ?? item._at} className="queue-item queue-item--sent">
                  <div className="queue-item-main">
                    <b>Manzana {item.manzana}</b>
                    <span>{TIPOS_VIALIDAD.find(t => t.code === item.tipo_vialidad)?.label ?? item.tipo_vialidad} {item.nombre_vialidad}</span>
                  </div>
                  <div className="queue-item-meta">
                    <span className="queue-item-folio">{item._folio}</span>
                    <span>{new Date(item._sentAt).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                    <span className="queue-item-badge queue-item-badge--sent">Enviado</span>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {queueTab === 'conflicts' && (
          <div className="queue-list">
            {conflicts.length === 0
              ? <p className="queue-empty">Sin conflictos.</p>
              : conflicts.map(item => (
                <div key={item._qid} className="queue-item queue-item--error">
                  <div className="queue-item-main">
                    <b>Manzana {item.manzana}</b>
                    <span>{TIPOS_VIALIDAD.find(t => t.code === item.tipo_vialidad)?.label ?? item.tipo_vialidad} {item.nombre_vialidad}</span>
                  </div>
                  <div className="queue-item-meta">
                    {item._folio && <span className="queue-item-folio">{item._folio}</span>}
                    <span>{new Date(item._conflictAt ?? item._at).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                    <span className="queue-item-badge queue-item-badge--error">Duplicado</span>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {queueTab === 'pending' && queue.length > 0 && online && (
          <button className="queue-sync-btn" onClick={onSync}>
            <IconSync /> Sincronizar ahora
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Main ──────────────────────────────────────────────── */
export default function FormCatastro({ onAdminClick, isAdmin = false }) {
  const [manzana, setManzana]           = useState('')
  const [tipoVialidad, setTipoVialidad] = useState('')
  const [nombreVialidad, setNombreVialidad] = useState('')
  const [servicios, setServicios]       = useState(
    Object.fromEntries(SERVICIOS_FULL.map(s => [s.key, '']))
  )
  const [tipoPavimento, setTipoPavimento] = useState('')
  const [equipamiento, setEquipamiento] = useState(
    Object.fromEntries(EQUIPAMIENTO_FULL.map(e => [e.key, '']))
  )
  const [infraMarkers, setInfraMarkers]  = useState([])
  const [observaciones, setObservaciones] = useState('')
  const [editingId, setEditingId]        = useState(null)
  const [recentList, setRecentList]     = useState(() => getRecent())
  const [toast, setToast]               = useState(null)
  const [theme, setTheme]               = useState(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )
  const [saving, setSaving]             = useState(false)
  const [savedSummary, setSavedSummary] = useState(null)
  const [queueTab, setQueueTab]         = useState('pending')
  const [sentList, setSentList]         = useState(() => getSent())
  const todayCount = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('es-MX', { year:'numeric', month:'2-digit', day:'2-digit' })
    const isToday = (d) => d && new Date(d).toLocaleDateString('es-MX', { year:'numeric', month:'2-digit', day:'2-digit' }) === todayStr
    return sentList.filter(i => isToday(i._sentAt)).length +
           getQueue().filter(i => isToday(i._at)).length
  }, [sentList])
  const [draft, setDraft] = useState(null)
  const draftLoadedRef = useRef(false)
  const [draftSavedAt, setDraftSavedAt] = useState(null)
  const [conflicts, setConflicts]         = useState(() => getConflicts())
  const [installPrompt, setInstallPrompt] = useState(null)
  const [refMarkers, setRefMarkers]     = useState([])
  const [registeredManzanas, setRegisteredManzanas] = useState([])
  const [mzSearch, setMzSearch]         = useState('')
  // Cache stores { manzana, data } so manzanaDup and checkingManzana are fully derived —
  // no synchronous setState needed in effects.
  const [manzanaDupCache, setManzanaDupCache] = useState(null)
  const manzanaDup = manzanaDupCache?.manzana === manzana ? manzanaDupCache.data : null
  const checkingManzana = Boolean(manzana && isConfigured && supabase && manzanaDupCache?.manzana !== manzana)
  const [vialDupData, setVialDupData]   = useState([])
  const [modals, setModals] = useState({ manzana: false, about: false, queue: false, progress: false, vialDup: false })
  const [sync, setSync] = useState({ online: navigator.onLine, pendingCount: queueSize(), syncing: false, progress: { done: 0, total: 0 }, lastAt: null, collapsed: false })

  const seccion1Completa   = manzana !== '' && !checkingManzana && !manzanaDup && tipoVialidad !== '' && nombreVialidad.trim() !== ''
  const serviciosCompletos = SERVICIOS_FULL.every(s => servicios[s.key] !== '')
  const equipamientoCompleto = EQUIPAMIENTO_FULL.every(e => equipamiento[e.key] !== '')

  const serviciosUnlocked = useMemo(() => {
    let c = 1
    for (let i = 0; i < SERVICIOS_FULL.length - 1; i++) {
      if (servicios[SERVICIOS_FULL[i].key] !== '') c++; else break
    }
    return c
  }, [servicios])

  const equipamientoUnlocked = useMemo(() => {
    let c = 1
    for (let i = 0; i < EQUIPAMIENTO_FULL.length - 1; i++) {
      if (equipamiento[EQUIPAMIENTO_FULL[i].key] !== '') c++; else break
    }
    return c
  }, [equipamiento])

  const { subtotal_servicios: subtotalServicios, subtotal_equipamiento: subtotalEquipamiento, total } = useMemo(
    () => calcSubtotals(servicios, equipamiento),
    [servicios, equipamiento]
  )

  const completedFields =
    (manzana ? 1 : 0) + (tipoVialidad ? 1 : 0) + (nombreVialidad.trim() ? 1 : 0) +
    SERVICIOS_FULL.filter(s => servicios[s.key] !== '').length +
    EQUIPAMIENTO_FULL.filter(e => equipamiento[e.key] !== '').length
  const progressPct = Math.round((completedFields / TOTAL_FIELDS) * 100)

  const handleServiceChange = useCallback((k, v) => {
    setServicios(p => ({ ...p, [k]: v }))
    if (k === 'pavimento' && v === 'N') setTipoPavimento('')
  }, [])

  const handleEquipChange = useCallback((k, v) => {
    setEquipamiento(p => ({ ...p, [k]: v }))
  }, [])

  const handleTipoChange = useCallback((v) => {
    setTipoPavimento(v)
  }, [])

  const toastTimer       = useRef(null)
  const showToastRef     = useRef(null)
  const undoRef          = useRef(null)
  const undoTimer        = useRef(null)
  const loadGenRef       = useRef(0)
  const autoRetryTimer   = useRef(null)
  const isSyncing        = useRef(false)
  const submitLock       = useRef(false)
  const autoRetryDelay   = useRef(30_000)
  const [undoSnack, setUndoSnack] = useState(null)  // { label } — shown for 5s after submit

  const showUndoSnack = (label, undoData) => {
    clearTimeout(undoTimer.current)
    undoRef.current = undoData
    setUndoSnack(label)
    undoTimer.current = setTimeout(() => { setUndoSnack(null); undoRef.current = null }, 5000)
  }

  const handleUndo = async () => {
    clearTimeout(undoTimer.current)
    setUndoSnack(null)
    const data = undoRef.current
    undoRef.current = null
    if (!data) return
    // Restore form state
    setManzana(data.formState.manzana)
    setTipoVialidad(data.formState.tipoVialidad)
    setNombreVialidad(data.formState.nombreVialidad)
    setServicios(data.formState.servicios)
    setTipoPavimento(data.formState.tipoPavimento)
    setEquipamiento(data.formState.equipamiento)
    setInfraMarkers(data.formState.infraMarkers)
    setObservaciones(data.formState.observaciones)
    try {
      if (data.qid != null) {
        await dequeue(data.qid)
        setSync(s => ({ ...s, pendingCount: queueSize() }))
      }
      if (data.dbId && isConfigured && supabase) {
        await supabase.from('registros').update({ deleted_at: new Date().toISOString() }).eq('id', data.dbId)
      }
      showToast('Envío deshecho')
    } catch {
      const mz = data.formState?.manzana
      showToast(`Error al deshacer${mz ? ` — manzana ${mz}` : ''} — el registro puede seguir guardado`, 'error')
    }
  }

  const showToast = (msg, type = 'info') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }
  showToastRef.current = showToast

  // Cargar borrador al montar (solo una vez)
  useEffect(() => {
    if (draftLoadedRef.current) return
    draftLoadedRef.current = true
    const d = loadDraft()
    if (d && !editingId) setDraft(d)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  // Update queue count and conflicts once IndexedDB finishes loading
  useEffect(() => {
    onQueueReady(({ queue, conflicts: c, sent: s }) => {
      setSync(prev => ({ ...prev, pendingCount: queue.length }))
      setConflicts(c)
      setSentList(s ?? [])
    })
  }, [])

  // Auto-guardar borrador con debounce de 1.5s (incluyendo modo edición)
  useEffect(() => {
    const hasData = manzana || nombreVialidad.trim() ||
      Object.values(servicios).some(v => v !== '') ||
      Object.values(equipamiento).some(v => v !== '') ||
      infraMarkers.length > 0 || observaciones.trim()
    if (!hasData && !editingId) { clearDraft(); return }
    const t = setTimeout(() => {
      saveDraft({ manzana, tipoVialidad, nombreVialidad, servicios, tipoPavimento, equipamiento, infraMarkers, observaciones, _at: Date.now(), _editingId: editingId ?? null })
      setDraftSavedAt(Date.now())
    }, 1500)
    return () => clearTimeout(t)
  }, [manzana, tipoVialidad, nombreVialidad, servicios, tipoPavimento, equipamiento, infraMarkers, observaciones, editingId])

  useEffect(() => {
    if (!manzana || !isConfigured || !supabase) return
    let cancelled = false
    const timer = setTimeout(() => {
      let q = supabase.from('registros').select('manzana').is('deleted_at', null).eq('manzana', manzana).limit(1)
      if (editingId) q = q.neq('id', editingId)
      q.then(({ data }) => {
        if (cancelled) return
        setManzanaDupCache({ manzana, data: data?.length ? true : null })
      }).catch(() => {
        if (!cancelled) setManzanaDupCache({ manzana, data: null })
      })
    }, 600)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [manzana, editingId])

  const prevS1    = useRef(false)
  const prevS2    = useRef(false)
  const seccion2Ref = useRef(null)
  const equipRef    = useRef(null)

  useEffect(() => {
    if (!prevS1.current && seccion1Completa) {
      showToast('Sección 1 completa')
      prevS1.current = seccion1Completa
      const t = setTimeout(() => seccion2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 600)
      return () => clearTimeout(t)
    }
    prevS1.current = seccion1Completa
  }, [seccion1Completa])

  useEffect(() => {
    if (!prevS2.current && serviciosCompletos) {
      showToast('Servicios completados')
      prevS2.current = serviciosCompletos
      const t = setTimeout(() => equipRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 600)
      return () => clearTimeout(t)
    }
    prevS2.current = serviciosCompletos
  }, [serviciosCompletos])

  // Cargar puntos ya registrados como referencia en el mapa
  useEffect(() => {
    if (!isConfigured || !supabase) return
    let mounted = true
    supabase.from('registros').select('manzana, infra_mapa').is('deleted_at', null).limit(500).then(({ data, error }) => {
      if (!mounted || error || !data) return
      const all = []
      data.forEach(r => {
        if (Array.isArray(r.infra_mapa)) {
          r.infra_mapa.forEach(m => all.push({ ...m, manzana: r.manzana }))
        }
      })
      setRefMarkers(all)
    }).catch(() => {})
    return () => { mounted = false }
  }, [])

  // Manzanas capturadas para el panel de progreso
  const fetchRegisteredManzanas = useCallback(() => {
    if (!isConfigured || !supabase) return
    supabase.from('registros').select('manzana, tipo_vialidad, nombre_vialidad, total')
      .is('deleted_at', null)
      .order('manzana', { ascending: true })
      .then(({ data }) => { if (data) setRegisteredManzanas(data) })
  }, [])

  useEffect(() => {
    fetchRegisteredManzanas()
    if (!isConfigured || !supabase) return
    let channel
    let reconnectTimer
    const subscribe = () => {
      channel = supabase.channel('manzanas-progress')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'registros' },
          () => fetchRegisteredManzanas())
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reconnectTimer = setTimeout(() => {
              supabase.removeChannel(channel)
              subscribe()
            }, 5000)
          }
        })
    }
    subscribe()
    return () => {
      clearTimeout(reconnectTimer)
      channel?.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [fetchRegisteredManzanas])

  const syncOfflineQueue = useCallback(async function syncOfflineQueue() {
    if (!isConfigured || !supabase) return
    if (isSyncing.current) return
    const queue = getQueue()
    if (!queue.length) return
    isSyncing.current = true
    setSync(s => ({ ...s, syncing: true, progress: { done: 0, total: queue.length } }))
    let synced = 0
    let newConflicts = 0
    let stuck = 0
    try {
      for (const item of queue) {
        const { _qid, _at, _folio, _retries: _r, _status: _st, ...record } = item // eslint-disable-line no-unused-vars
        const { error } = await supabase.from('registros').insert([record])
        if (!error) {
          await dequeue(_qid)
          await addSent({ manzana: item.manzana, tipo_vialidad: item.tipo_vialidad,
            nombre_vialidad: item.nombre_vialidad, total: item.total,
            _folio, _at, _sentAt: new Date().toISOString() })
          setSentList(getSent())
          synced++
        } else if (error.code === '23505') {
          await dequeue(_qid)
          await addConflict({ ...record, _qid, _at, _folio })
          newConflicts++
        } else {
          await markStuck(_qid)
          stuck++
        }
        setSync(s => ({ ...s, progress: { done: synced + newConflicts + stuck, total: queue.length } }))
      }
      if (stuck > 0 && synced === 0 && newConflicts === 0) {
        showToastRef.current(`Error del servidor — ${stuck} registro${stuck > 1 ? 's' : ''} sin enviar, se reintentará`, 'error')
      } else if (synced > 0 && newConflicts === 0 && stuck === 0) {
        showToastRef.current(`${synced} registro${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''}`)
      } else if (synced > 0 && newConflicts > 0 && stuck === 0) {
        showToastRef.current(`${synced} sincronizado${synced > 1 ? 's' : ''} — ${newConflicts} conflicto${newConflicts > 1 ? 's' : ''}`)
      } else if (newConflicts > 0 && synced === 0 && stuck === 0) {
        showToastRef.current(`${newConflicts} manzana${newConflicts > 1 ? 's' : ''} ya registrada${newConflicts > 1 ? 's' : ''} por otro capturista`)
      } else if (stuck > 0) {
        showToastRef.current(`${synced > 0 ? `${synced} enviado${synced > 1 ? 's' : ''} — ` : ''}${stuck} sin enviar por error del servidor`)
      }
    } catch {
      showToastRef.current('Error inesperado durante sincronización', 'error')
    } finally {
      isSyncing.current = false
      setConflicts(getConflicts())
      setSync(s => ({ ...s, pendingCount: queueSize(), syncing: false, ...(synced > 0 || newConflicts > 0 ? { lastAt: new Date().toISOString() } : {}) }))
      clearTimeout(autoRetryTimer.current)
      if (stuck > 0 && navigator.onLine) {
        autoRetryTimer.current = setTimeout(syncOfflineQueue, autoRetryDelay.current)
        autoRetryDelay.current = Math.min(autoRetryDelay.current * 2, 8 * 60 * 1000)
      } else {
        autoRetryDelay.current = 30_000
      }
    }
  }, [])

  // Online / offline detection
  useEffect(() => {
    const goOnline  = () => {
      setSync(s => ({ ...s, online: true }))
      clearTimeout(autoRetryTimer.current)
      autoRetryDelay.current = 30_000
      syncOfflineQueue()
    }
    const goOffline = () => { setSync(s => ({ ...s, online: false })); clearTimeout(autoRetryTimer.current) }
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    if (navigator.onLine && queueSize() > 0) syncOfflineQueue()
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
      clearTimeout(autoRetryTimer.current)
    }
  }, [syncOfflineQueue])

  useEffect(() => () => {
    clearTimeout(toastTimer.current)
    clearTimeout(undoTimer.current)
  }, [])

  // Escape para cerrar todos los modales inline
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape') return
      if (modals.queue)    { setModals(m => ({ ...m, queue: false }));    return }
      if (modals.progress) { setModals(m => ({ ...m, progress: false })); setMzSearch(''); return }
    }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [modals])

  // Bloquear scroll del fondo cuando cualquier modal está abierto
  useEffect(() => {
    const anyOpen = modals.manzana || !!savedSummary || modals.queue || modals.vialDup || modals.progress
    document.body.style.overflow = anyOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modals, savedSummary])

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Warn before closing if form has unsaved data
  useEffect(() => {
    const hasData = manzana || nombreVialidad.trim() ||
      Object.values(servicios).some(v => v !== '') ||
      Object.values(equipamiento).some(v => v !== '') ||
      infraMarkers.length > 0 || observaciones.trim()
    if (!hasData) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [manzana, nombreVialidad, servicios, equipamiento, infraMarkers, observaciones])

  const handleReset = () => {
    loadGenRef.current++  // Cancels any in-flight handleLoadByManzana
    setManzana(''); setTipoVialidad(''); setNombreVialidad('')
    setServicios(Object.fromEntries(SERVICIOS_FULL.map(s => [s.key, ''])))
    setTipoPavimento('')
    setEquipamiento(Object.fromEntries(EQUIPAMIENTO_FULL.map(e => [e.key, ''])))
    setInfraMarkers([])
    setObservaciones('')
    setToast(null); setSaving(false); setManzanaDupCache(null); setEditingId(null)
    clearDraft()
    setDraft(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleRestoreDraft = () => {
    if (!draft) return
    setManzana(draft.manzana ?? '')
    setTipoVialidad(draft.tipoVialidad ?? '')
    setNombreVialidad(draft.nombreVialidad ?? '')
    setServicios(draft.servicios ?? Object.fromEntries(SERVICIOS_FULL.map(s => [s.key, ''])))
    setTipoPavimento(draft.tipoPavimento ?? '')
    setEquipamiento(draft.equipamiento ?? Object.fromEntries(EQUIPAMIENTO_FULL.map(e => [e.key, ''])))
    setInfraMarkers(Array.isArray(draft.infraMarkers) ? draft.infraMarkers : [])
    setObservaciones(draft.observaciones ?? '')
    setEditingId(draft._editingId ?? null)
    setDraft(null)
    clearDraft()
    showToast('Borrador restaurado')
  }

  async function handleLoadByManzana(manzanaNum) {
    if (!isConfigured || !supabase) return
    const myGen = ++loadGenRef.current
    setSaving(true)
    try {
      const { data } = await supabase.from('registros').select('*').is('deleted_at', null).eq('manzana', manzanaNum).limit(1).single()
      if (myGen !== loadGenRef.current) return
      setManzana(manzanaNum)
      setEditingId(data.id)
      setTipoVialidad(data.tipo_vialidad ?? '')
      setNombreVialidad(data.nombre_vialidad ?? '')
      setServicios(data.servicios ?? {})
      setEquipamiento(data.equipamiento ?? {})
      setTipoPavimento(data.tipo_pavimento ?? '')
      setInfraMarkers(Array.isArray(data.infra_mapa) ? data.infra_mapa : [])
      setObservaciones(data.observaciones ?? '')
      setManzanaDupCache({ manzana: manzanaNum, data: null })
      showToast('Editando manzana ' + manzanaNum)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      if (myGen !== loadGenRef.current) return
      showToast('Error al cargar el registro', 'error')
    } finally {
      if (myGen === loadGenRef.current) setSaving(false)
    }
  }

  const saveOffline = async (record, formSnap, label) => {
    try {
      const item = await enqueue(record)
      setSync(s => ({ ...s, pendingCount: queueSize() }))
      addRecent(record)
      setRecentList(getRecent())
      setSavedSummary({ ...record, _offline: true, _folio: item._folio })
      showUndoSnack(label, { formState: formSnap, qid: item._qid, dbId: null })
      handleReset()
    } catch {
      showToast('Error al guardar localmente — intenta de nuevo', 'error')
    }
  }

  const handleSubmit = async (skipVialCheck = false) => {
    if (submitLock.current) return
    if (!manzana)              { showToast('Selecciona el número de manzana'); return }
    if (!tipoVialidad)         { showToast('Selecciona el tipo de vialidad'); return }
    if (!nombreVialidad.trim()) { showToast('Escribe el nombre de la vialidad'); return }
    if (!serviciosCompletos)   { showToast('Completa todos los servicios'); return }
    if (servicios.pavimento && servicios.pavimento !== 'N' && !tipoPavimento) {
      showToast('Selecciona el tipo de pavimento'); return
    }
    if (!equipamientoCompleto) { showToast('Completa el equipamiento urbano'); return }

    const record = {
      manzana,
      tipo_vialidad:         tipoVialidad,
      nombre_vialidad:       nombreVialidad,
      servicios,
      tipo_pavimento:        tipoPavimento || null,
      equipamiento,
      infra_mapa:            infraMarkers,
      subtotal_servicios:    subtotalServicios,
      subtotal_equipamiento: subtotalEquipamiento,
      total,
      observaciones:         observaciones.trim() || null,
    }
    const formSnap = { manzana, tipoVialidad, nombreVialidad, servicios: {...servicios},
      tipoPavimento, equipamiento: {...equipamiento}, infraMarkers: [...infraMarkers],
      observaciones }

    if (!isConfigured || !supabase) {
      addRecent(record)
      setRecentList(getRecent())
      setSavedSummary({ ...record, _offline: false })
      showUndoSnack('Registro guardado — ¿Deshacer?', { formState: formSnap, qid: null, dbId: null })
      handleReset()
      return
    }

    if (editingId) {
      // Modo edición — UPDATE (sin undo, demasiado complejo)
      setSaving(true)
      let error
      try {
        ;({ error } = await supabase.from('registros').update(record).eq('id', editingId))
      } finally {
        setSaving(false)
      }
      if (error) { showToast('Error al actualizar: ' + error.message, 'error'); return }
      addRecent(record)
      setRecentList(getRecent())
      setSavedSummary({ ...record, _offline: false, _updated: true })
      handleReset()
      return
    }

    if (!navigator.onLine) {
      await saveOffline(record, formSnap, 'Guardado sin internet — ¿Deshacer?')
      return
    }

    // Check duplicate vialidad (same street, different manzana number)
    if (!skipVialCheck && isConfigured && supabase && nombreVialidad.trim()) {
      try {
        const { data: vialDup } = await supabase.from('registros')
          .select('manzana, nombre_vialidad')
          .is('deleted_at', null)
          .ilike('nombre_vialidad', nombreVialidad.trim())
          .limit(5)
        if (vialDup?.length && !vialDup.some(d => String(d.manzana) === String(manzana))) {
          setVialDupData(vialDup)
          setModals(m => ({ ...m, vialDup: true }))
          return
        }
      } catch {
        // Non-critical check — continue to online insert
      }
    }

    // Online insert — verificar duplicado antes (cubre race conditions)
    const folio = `FOL-${String(manzana).padStart(3, '0')}-${Date.now().toString(36).slice(-4).toUpperCase()}`
    submitLock.current = true
    setSaving(true)
    let existing, inserted, error
    try {
      ;({ data: existing } = await supabase
        .from('registros').select('manzana').is('deleted_at', null).eq('manzana', manzana).limit(1))
      if (existing?.length) {
        showToast(`La manzana ${manzana} ya está registrada — selecciona otra`)
        setManzana('')
        setManzanaDupCache(null)
        return
      }
      ;({ data: inserted, error } = await supabase.from('registros').insert([record]).select('id').single())
    } finally {
      setSaving(false)
      submitLock.current = false
    }
    if (error) {
      if (error.code === '23505') {
        showToast(`La manzana ${manzana} ya está registrada — selecciona otra`)
        setManzana('')
        setManzanaDupCache(null)
        return
      }
      await saveOffline(record, formSnap, 'Error de red — guardado local ¿Deshacer?')
      return
    }
    await addSent({ manzana: record.manzana, tipo_vialidad: record.tipo_vialidad,
      nombre_vialidad: record.nombre_vialidad, total: record.total,
      _folio: folio, _sentAt: new Date().toISOString() })
    setSentList(getSent())
    addRecent(record)
    setRecentList(getRecent())
    setSavedSummary({ ...record, _offline: false, _folio: folio })
    showUndoSnack('Registro enviado — ¿Deshacer?', { formState: formSnap, qid: null, dbId: inserted?.id ?? null })
    handleReset()
  }

  /* ── Form ── */
  return (
    <div className="fc-page">
      {modals.manzana && (
        <ManzanaModal
          current={manzana}
          onConfirm={v => { setManzana(v); setModals(m => ({ ...m, manzana: false })) }}
          onClose={() => setModals(m => ({ ...m, manzana: false }))}
        />
      )}

      {/* ── Modal duplicado vialidad ── */}
      {modals.vialDup && (
        <VialDupModal
          nombreVialidad={nombreVialidad}
          vialDupData={vialDupData}
          onCancel={() => setModals(m => ({ ...m, vialDup: false }))}
          onConfirm={() => { setModals(m => ({ ...m, vialDup: false })); handleSubmit(true) }}
        />
      )}

      {/* ── Confirmación post-envío ── */}
      {savedSummary && (
        <SavedSummaryModal
          savedSummary={savedSummary}
          isAdmin={isAdmin}
          showToast={showToast}
          onClose={() => setSavedSummary(null)}
        />
      )}

      {/* ── Modal progreso manzanas ── */}
      {modals.progress && (
        <ProgressModal
          registeredManzanas={registeredManzanas}
          mzSearch={mzSearch}
          setMzSearch={setMzSearch}
          onClose={() => { setModals(m => ({ ...m, progress: false })); setMzSearch('') }}
          onLoad={handleLoadByManzana}
          showToast={showToastRef.current}
        />
      )}

      {/* ── Modal de registros (pendientes / enviados / conflictos) ── */}
      {modals.queue && (
        <QueueModal
          sentList={sentList}
          conflicts={conflicts}
          queueTab={queueTab}
          setQueueTab={setQueueTab}
          online={sync.online}
          onSync={() => { syncOfflineQueue(); setModals(m => ({ ...m, queue: false })) }}
          onClose={() => setModals(m => ({ ...m, queue: false }))}
        />
      )}

      {toast && (
        <div
          className={`fc-toast${toast.type === 'error' ? ' fc-toast--error' : ''}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >{toast.msg}</div>
      )}
      {undoSnack && (
        <div className="fc-undo-snack" role="status" aria-live="polite" aria-atomic="true">
          <span>{undoSnack}</span>
          <button className="fc-undo-btn" onClick={handleUndo}>Deshacer</button>
          <button className="fc-undo-dismiss" aria-label="Cerrar aviso" onClick={() => { clearTimeout(undoTimer.current); setUndoSnack(null) }}><IconClose /></button>
        </div>
      )}

      {/* ── Banners section ── */}
      {(() => {
        const activeBannerCount = [
          !sync.online,
          sync.online && sync.pendingCount > 0,
          conflicts.length > 0,
          Boolean(draft && !editingId),
          Boolean(installPrompt),
        ].filter(Boolean).length
        const showToggle = activeBannerCount >= 3
        return (
          <>
            {showToggle && (
              <button
                className="banners-toggle"
                aria-expanded={!sync.collapsed}
                aria-controls="fc-banners-region"
                onClick={() => setSync(s => ({ ...s, collapsed: !s.collapsed }))}
              >
                {sync.collapsed ? `${activeBannerCount} avisos activos — ver todos` : 'Colapsar avisos'}
              </button>
            )}
            <div id="fc-banners-region" className={showToggle && sync.collapsed ? 'fc-banners fc-banners--collapsed' : 'fc-banners'} aria-hidden={showToggle && sync.collapsed}>
              {/* Offline banner */}
              {!sync.online && (
                <div className="offline-banner">
                  <span className="offline-dot" /> Sin internet — los registros se guardarán localmente
                </div>
              )}

              {/* Pending sync banner */}
              {sync.online && sync.pendingCount > 0 && (
                <div className="sync-banner" aria-live="polite" aria-atomic="true">
                  {sync.syncing ? (
                    <span className="sync-banner-label sync-banner-label--syncing">
                      <IconSync /> Sincronizando {sync.progress.done}/{sync.progress.total}…
                    </span>
                  ) : (
                    <button className="sync-banner-label" onClick={() => setModals(m => ({ ...m, queue: true }))}>
                      <IconSync /> {sync.pendingCount} registro{sync.pendingCount > 1 ? 's' : ''} pendiente{sync.pendingCount > 1 ? 's' : ''} de sincronizar
                      {sync.lastAt && <span className="sync-last"> · {relativeTime(sync.lastAt)}</span>}
                    </button>
                  )}
                  {sync.syncing ? (
                    <div className="fc-sync-bar">
                      <div className="fc-sync-bar-fill" style={{ width: `${sync.progress.total ? Math.round((sync.progress.done / sync.progress.total) * 100) : 0}%` }} />
                    </div>
                  ) : (
                    <button className="sync-now-btn" onClick={syncOfflineQueue}>Sincronizar ahora</button>
                  )}
                </div>
              )}

              {/* Conflictos banner */}
              {conflicts.length > 0 && (
                <div className="conflict-banner">
                  <div className="conflict-banner-content">
                    <span className="conflict-icon"><IconWarning /></span>
                    <div className="conflict-text">
                      <strong>{conflicts.length} manzana{conflicts.length > 1 ? 's' : ''} con conflicto</strong>
                      <span>
                        {conflicts.map(c => `Mz ${c.manzana}`).join(', ')} — ya {conflicts.length > 1 ? 'fueron registradas' : 'fue registrada'} por otro capturista. Avisa al administrador.
                      </span>
                    </div>
                  </div>
                  <button className="conflict-dismiss" onClick={() => { clearConflicts(); setConflicts([]) }} title="Descartar" aria-label="Descartar conflictos"><IconClose /></button>
                </div>
              )}

              {/* Draft restore banner */}
              {draft && !editingId && (
                <div className="draft-banner">
                  <div className="draft-banner-info">
                    <span className="draft-icon"><IconDraft /></span>
                    <div>
                      <strong>Borrador guardado</strong>
                      <span>Manzana {draft.manzana || '—'} · {new Date(draft._at).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                    </div>
                  </div>
                  <div className="draft-banner-btns">
                    <button className="draft-restore-btn" onClick={handleRestoreDraft}>Restaurar</button>
                    <button className="draft-dismiss-btn" onClick={() => { setDraft(null); clearDraft() }}>Descartar</button>
                  </div>
                </div>
              )}

              {/* Install PWA banner */}
              {installPrompt && (
                <div className="install-banner">
                  <span className="install-banner-label"><IconInstall /> Instala la app para usarla sin internet</span>
                  <button className="install-btn" onClick={async () => {
                    installPrompt.prompt()
                    const { outcome } = await installPrompt.userChoice
                    if (outcome === 'accepted') setInstallPrompt(null)
                  }}>Instalar</button>
                  <button className="install-dismiss" aria-label="Cerrar invitación de instalación" onClick={() => setInstallPrompt(null)}><IconClose /></button>
                </div>
              )}
            </div>
          </>
        )
      })()}

      <header className="fc-topbar">
        <div className="fc-topbar-inner">
          <div className="fc-topbar-brand">
            <IconAppLogo size={26} />
            <span>Catastro</span>
          </div>
          <div className="fc-topbar-progress">
            <div className="fc-topbar-track">
              <div className={`fc-topbar-fill${progressPct === 100 ? ' fc-topbar-fill--done' : ''}`} style={{ width: `${progressPct}%` }} />
            </div>
            <span className={progressPct === 100 ? 'fc-topbar-pct--done' : undefined}>{progressPct === 100 ? <IconCheck /> : `${progressPct}%`}</span>
          </div>
          <div className="fc-topbar-right">
            {!sync.online && <span className="topbar-offline-badge">Offline</span>}
            {sync.online && sync.pendingCount > 0 && <button className="topbar-pending-badge" onClick={() => setModals(m => ({ ...m, queue: true }))}>{sync.pendingCount}</button>}
            <span className="fc-today-count">{todayCount} hoy</span>
            {registeredManzanas.length > 0 && (
              <button className="fc-mz-count-btn" onClick={() => setModals(m => ({ ...m, progress: true }))}>
                {registeredManzanas.length} mz
              </button>
            )}
            <button
              className="fc-theme-btn"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark'
                ? <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1.5" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="14.5"/><line x1="1.5" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="14.5" y2="8"/><line x1="3.5" y1="3.5" x2="4.5" y2="4.5"/><line x1="11.5" y1="11.5" x2="12.5" y2="12.5"/><line x1="12.5" y1="3.5" x2="11.5" y2="4.5"/><line x1="4.5" y1="11.5" x2="3.5" y2="12.5"/></svg>
                : <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 12.5A6 6 0 0 1 5.5 4a6 6 0 1 0 6.5 8.5Z"/></svg>
              }
            </button>
            <button className="fc-admin-btn" onClick={onAdminClick}><IconLock /> Admin</button>
          </div>
        </div>
      </header>

      <form className="fc-form" onSubmit={e => { e.preventDefault(); if (!saving) handleSubmit() }}>
        {/* Hero */}
        <div className="fc-hero">
          <div className="fc-hero-brand">
            <div className="fc-hero-icon">
              <IconAppLogo size={42} />
            </div>
            <div>
              <h1>Catastro</h1>
              <p>Captura de Servicios e Infraestructura</p>
            </div>
          </div>
          <div className="fc-steps" role="list" aria-label="Progreso del formulario">
            {[
              { label: 'Identificación', done: seccion1Completa, active: !seccion1Completa },
              { label: 'Servicios',      done: serviciosCompletos, active: seccion1Completa && !serviciosCompletos },
              { label: 'Equipamiento',   done: equipamientoCompleto, active: serviciosCompletos && !equipamientoCompleto },
            ].map((step, i) => (
              <span
                key={i}
                role="listitem"
                aria-label={`${step.label}: ${step.done ? 'completado' : step.active ? 'en progreso' : 'pendiente'}`}
                className={`fc-step ${step.done ? 'step-done' : step.active ? 'step-active' : ''}`}
              >
                <span className="step-num" aria-hidden="true">{step.done ? <IconCheck /> : i + 1}</span>
                <span aria-hidden="true">{step.label}</span>
                {i < 2 && <span className="step-sep" aria-hidden="true" />}
              </span>
            ))}
          </div>
        </div>

        {/* ── Historial reciente ── */}
        {recentList.length > 0 && !editingId && (
          <div className="recent-section">
            <div className="recent-label">Capturas recientes</div>
            <div className="recent-list" role="list" aria-label="Capturas recientes">
              {recentList.map(r => (
                <button
                  key={`${r.manzana}-${r.at}`}
                  type="button"
                  className="recent-chip"
                  onClick={() => handleLoadByManzana(r.manzana)}
                  disabled={saving}
                >
                  <span className="recent-chip-mz">Mz {r.manzana}</span>
                  <span className="recent-chip-via">{TIPOS_VIALIDAD.find(t => t.code === r.tipo_vialidad)?.label ?? r.tipo_vialidad} {r.nombre_vialidad}</span>
                  <span className="recent-chip-meta">
                    {isAdmin && r.total != null && <span className="recent-chip-score">{Number(r.total).toFixed(2)}</span>}
                    <span className="recent-chip-time">{relativeTime(r.at)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Edit mode banner ── */}
        {editingId && (
          <div className="edit-mode-banner">
            <span className="edit-mode-icon"><IconPencil /></span>
            <span>Editando manzana <strong>{manzana}</strong></span>
            <button type="button" className="edit-mode-cancel" onClick={handleReset}>Cancelar</button>
          </div>
        )}

        {/* ══ Card 1 ══ */}
        <div className={`fc-card ${seccion1Completa ? 'card-done' : ''}`}>
          <div className="card-head">
            <span className="card-num">{seccion1Completa ? <IconCheck /> : '1'}</span>
            <div>
              <h2>Identificación</h2>
              <p>Localización de la manzana</p>
            </div>
          </div>
          <div className="card-body">

            {/* Manzana */}
            <div className="fc-field">
              <label id="label-manzana"><span className="field-icon"><IconHash /></span> Manzana <InfoTooltip text={"Número del plano catastral.\nFormato X.Y:\n  X = zona   Y = número en la zona\n\nEjemplos: 1.1 · 2.4 · 10.3"} /></label>
              <button
                type="button"
                className={`manzana-trigger ${manzana ? 'has-value' : ''} ${manzanaDup ? 'manzana-trigger-dup' : ''}`}
                aria-labelledby="label-manzana"
                aria-haspopup="dialog"
                aria-required="true"
                onClick={() => { if (!checkingManzana) setModals(m => ({ ...m, manzana: true })) }}
                disabled={checkingManzana}
                aria-busy={checkingManzana}
              >
                <span className="manzana-icon"><IconMap /></span>
                {manzana
                  ? <><span className="manzana-val">{manzana}</span><span className="manzana-edit">Cambiar</span></>
                  : <span className="manzana-placeholder">Seleccionar número de manzana</span>
                }
              </button>
              {checkingManzana && (
                <div className="manzana-hint manzana-hint-checking">
                  <span className="manzana-checking-spinner" aria-hidden="true"/>
                  Verificando que la manzana {manzana} esté disponible…
                </div>
              )}
              {manzanaDup && (
                <div className="manzana-hint manzana-hint-dup" role="alert">
                  La manzana {manzana} ya está registrada — selecciona otra
                </div>
              )}
            </div>

            {/* Tipo Vialidad */}
            <div className="fc-field">
              <label><span className="field-icon"><IconRoadType /></span> Tipo de Vialidad <InfoTooltip text={"Vía que bordea la manzana:\nCAL = Calle\nAVE = Avenida\nBLV = Boulevard\nCJN = Callejón\nCDA = Cerrada\nCZA = Calzada\nCAR = Carretera"} /></label>
              <div className="vial-grid" role="group" aria-label="Tipo de vialidad" aria-required="true">
                {TIPOS_VIALIDAD.map(t => (
                  <button
                    key={t.code}
                    type="button"
                    className={`vial-btn ${tipoVialidad === t.code ? 'active' : ''}`}
                    aria-pressed={tipoVialidad === t.code}
                    aria-label={`${t.label} (${t.code})`}
                    onClick={() => setTipoVialidad(t.code)}
                  >
                    <span className="vial-code" aria-hidden="true">{t.code}</span>
                    <span className="vial-name" aria-hidden="true">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Nombre Vialidad */}
            <div className="fc-field">
              <label htmlFor="nombre-vialidad"><span className="field-icon"><IconMap /></span> Nombre de la Vialidad</label>
              <div className="input-wrap">
                <input
                  id="nombre-vialidad"
                  type="text"
                  className="fc-input"
                  value={nombreVialidad}
                  onChange={e => setNombreVialidad(e.target.value)}
                  placeholder="Ej. Miguel Hidalgo, López Mateos…"
                  autoCapitalize="words"
                  autoCorrect="off"
                  autoComplete="off"
                  required
                  aria-required="true"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && seccion1Completa)
                      seccion2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                  }}
                />
                {nombreVialidad.trim() && <span className="input-ok"><IconCheck /></span>}
              </div>
            </div>
          </div>
        </div>

        {/* ══ Card 2 ══ */}
        <div ref={seccion2Ref} className={`fc-card ${!seccion1Completa ? 'card-blocked' : ''} ${serviciosCompletos ? 'card-done' : ''}`}>
          <div className="card-head">
            <span className="card-num" style={!seccion1Completa ? { background: 'var(--border)', color: 'var(--ink-4)' } : {}}>
              {serviciosCompletos ? <IconCheck /> : '2'}
            </span>
            <div>
              <h2>Servicios e Infraestructura</h2>
              <p>{seccion1Completa
                ? 'Evalúa la calidad de cada servicio'
                : checkingManzana
                  ? 'Espera — verificando disponibilidad de la manzana…'
                  : 'Completa la sección 1 para continuar'
              }</p>
            </div>
            {!seccion1Completa && <span className="card-lock-icon"><IconLock /></span>}
          </div>

          {seccion1Completa && (
            <div className="card-body">
              <div className="legend-row">
                {OPCIONES_SERVICIO.map(o => (
                  <span key={o.val} className={`legend-pill lp-${o.color}`}>{o.label}</span>
                ))}
                <InfoTooltip text={"Calidad del servicio en la manzana:\nBueno — existe y funciona bien\nRegular — existe pero con fallas\nMalo — en muy mal estado\nNinguno — no existe"} />
              </div>

              <div className="fc-rows">
                {SERVICIOS_FULL.map((item, idx) => {
                  const locked = idx >= serviciosUnlocked
                  return (
                    <ServiceRow
                      key={item.key}
                      item={item}
                      value={servicios[item.key]}
                      locked={locked}
                      isNext={idx === serviciosUnlocked}
                      onChange={handleServiceChange}
                      tipoPavimento={item.hasTipo ? tipoPavimento : undefined}
                      onTipoChange={item.hasTipo ? handleTipoChange : undefined}
                    />
                  )
                })}
              </div>

              {/* Equipamiento subsection */}
              <div ref={equipRef} className={`equip-section ${!serviciosCompletos ? 'equip-locked' : ''}`}>
                <div className="equip-head">
                  <h3>Equipamiento Urbano <InfoTooltip text={"¿Existe dentro o cerca de la manzana?\nSí hay = presente y accesible\nNo hay = ausente o inaccesible"} /></h3>
                  {!serviciosCompletos
                    ? <span className="equip-lock-note"><IconLock /> Completa los servicios primero</span>
                    : <span className="equip-ready-note">Indica la presencia de cada equipamiento</span>
                  }
                </div>

                {serviciosCompletos && (
                  <>
                    <div className="legend-row">
                      <span className="legend-pill lp-green">Sí hay</span>
                      <span className="legend-pill lp-muted">No hay</span>
                    </div>
                    <div className="fc-rows">
                      {EQUIPAMIENTO_FULL.map((item, idx) => (
                        <EquipRow
                          key={item.key}
                          item={item}
                          value={equipamiento[item.key]}
                          locked={idx >= equipamientoUnlocked}
                          isNext={idx === equipamientoUnlocked}
                          onChange={handleEquipChange}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ══ Card 3 — Mapa de Infraestructura ══ */}
        <MapaInfraestructura
          markers={infraMarkers}
          onChange={setInfraMarkers}
          blocked={!equipamientoCompleto}
          blockReason={
            !serviciosCompletos ? 'Completa los servicios e infraestructura primero' :
            !equipamientoCompleto ? 'Completa el equipamiento urbano primero' : ''
          }
          refMarkers={refMarkers}
        />


        {/* Live score — solo admin */}
        {isAdmin && seccion1Completa && (
          <div className="score-panel">
            <ScoreGauge value={total} />
            <p className="score-panel-label">Puntaje en tiempo real</p>
            <div className="score-panel-grid">
              <div>
                <span>Servicios respondidos</span>
                <b>{SERVICIOS_FULL.filter(s => servicios[s.key]).length} / {SERVICIOS_FULL.length}</b>
              </div>
              <div>
                <span>Equipamiento respondido</span>
                <b>{EQUIPAMIENTO_FULL.filter(e => equipamiento[e.key] !== '').length} / {EQUIPAMIENTO_FULL.length}</b>
              </div>
              <div className="score-panel-sub">
                <span>Subtotal servicios</span>
                <b>{subtotalServicios.toFixed(2)}</b>
              </div>
              <div className="score-panel-sub">
                <span>Subtotal equipamiento</span>
                <b>{subtotalEquipamiento}</b>
              </div>
            </div>
          </div>
        )}

        {equipamientoCompleto && (
          <>
            {/* ══ Card 4 — Observaciones ══ */}
            <div className="obs-card">
              <div className="obs-card-head">
                <span className="obs-card-num">4</span>
                <div>
                  <h2><label htmlFor="observaciones" style={{ cursor:'pointer' }}>Observaciones</label> <InfoTooltip text={"Situaciones especiales a registrar:\n· Daños visibles\n· Acceso difícil u obras en proceso\n· Conflictos de uso de suelo\n· Zonas de riesgo\n\nEste campo es opcional."} /></h2>
                  <p>Notas adicionales sobre la manzana (opcional)</p>
                </div>
              </div>
              <div className="obs-card-body">
                <textarea
                  id="observaciones"
                  className="obs-textarea"
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value.slice(0, 500))}
                  placeholder="Escribe aquí cualquier observación relevante sobre la manzana, sus calles o condiciones especiales…"
                  rows={4}
                  aria-label="Observaciones"
                  maxLength={500}
                />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  {draftSavedAt && !editingId && (
                    <span key={draftSavedAt} className="draft-saved-hint">
                      ✓ Borrador guardado
                    </span>
                  )}
                  <div style={{ marginLeft:'auto' }}>
                    <span className={`obs-char-count${observaciones.length >= 450 ? ' obs-char-warn' : ''}${observaciones.length >= 490 ? ' obs-char-limit' : ''}`}>
                      {observaciones.length} / 500
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-submit"
              disabled={saving}
              aria-busy={saving}
              aria-label={saving ? (editingId ? 'Actualizando registro…' : 'Guardando registro…') : undefined}
            >
              {saving
                ? <><span className="btn-spinner" aria-hidden="true"/> {editingId ? 'Actualizando…' : 'Guardando…'}</>
                : (editingId ? 'Actualizar registro' : 'Guardar registro')}
            </button>
          </>
        )}
      </form>

      {/* Firma del desarrollador */}
      <button className="fc-dev-credit" onClick={() => setModals(m => ({ ...m, about: true }))}>
        <img src={logoSrc} alt="HL Dev" className="fc-dev-logo"/>
        <span>Desarrollado por <strong>HL Dev</strong></span>
      </button>

      {modals.about && <AboutModal onClose={() => setModals(m => ({ ...m, about: false }))}/>}
    </div>
  )
}
