import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
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

const DRAFT_KEY = 'catastro_draft'

function loadDraft() {
  try { const d = localStorage.getItem(DRAFT_KEY); return d ? JSON.parse(d) : null } catch { return null }
}
function saveDraft(data) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)) } catch {}
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch {}
}

function relativeTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diffM = Math.floor((Date.now() - d) / 60000)
  if (diffM < 2) return 'Ahora'
  if (diffM < 60) return `Hace ${diffM} min`
  const diffH = Math.floor(diffM / 60)
  if (diffH < 24) return `Hace ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'Ayer'
  if (diffD < 7) return `Hace ${diffD} días`
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

/* ── Score gauge — SVG half-arc ── */
function ScoreGauge({ value, max = 15.08 }) {
  const pct = Math.min(Math.max(value / max, 0), 1)
  const r = 38, cx = 50, cy = 52
  const len = Math.PI * r
  const color = value >= 12 ? '#15803d' : value >= 8 ? '#6366f1' : '#b45309'
  const arc  = `M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`
  return (
    <div className="score-gauge" aria-label={`Puntaje ${value.toFixed(2)} de ${max}`}>
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
const TIPOS_VIALIDAD = [
  { code: 'AVE', label: 'Avenida' },
  { code: 'BLV', label: 'Boulevard' },
  { code: 'CAL', label: 'Calle' },
  { code: 'CJN', label: 'Callejón' },
  { code: 'CDA', label: 'Cerrada' },
  { code: 'CZA', label: 'Calzada' },
  { code: 'CAR', label: 'Carretera' },
]

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

const TIPOS_PAVIMENTO = [
  { code: 'AD', label: 'Adoquín' },
  { code: 'HI', label: 'Concreto Hidráulico' },
  { code: 'AS', label: 'Asfalto' },
  { code: 'EM', label: 'Empedrado' },
  { code: 'TE', label: 'Terracería' },
  { code: 'TI', label: 'Tierra' },
]

const SERVICIOS_LIST = [
  { key: 'aguaPotable',       label: 'Agua Potable' },
  { key: 'drenaje',           label: 'Drenaje' },
  { key: 'alcantarillado',    label: 'Alcantarillado' },
  { key: 'electrificacion',   label: 'Electrificación' },
  { key: 'guarniciones',      label: 'Guarniciones' },
  { key: 'banquetas',         label: 'Banquetas' },
  { key: 'pavimento',         label: 'Pavimento', hasTipo: true },
  { key: 'recoleccionBasura', label: 'Recolección de Basura' },
]

const EQUIPAMIENTO_LIST = [
  { key: 'educacionCultura',  label: 'Educación y Cultura' },
  { key: 'transportePublico', label: 'Transporte Público' },
  { key: 'comercioAbasto',    label: 'Comercio y Abasto' },
  { key: 'recreacionDeporte', label: 'Recreación y Deporte' },
  { key: 'saludAsistencia',   label: 'Salud y Asistencia' },
  { key: 'telefono',          label: 'Teléfono' },
  { key: 'correosYTelegrafo', label: 'Correos y Telégrafo' },
  { key: 'contaminacion',     label: 'Contaminación' },
  { key: 'calleEspecial',     label: 'Calle Especial' },
]

const OPCIONES_SERVICIO = [
  { val: 'B', label: 'Bueno',   peso: 0.76, color: 'green' },
  { val: 'R', label: 'Regular', peso: 0.70, color: 'amber' },
  { val: 'M', label: 'Malo',    peso: 0.64, color: 'red'   },
  { val: 'N', label: 'Ninguno', peso: 1.00, color: 'muted' },
]

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

const TOTAL_FIELDS = 3 + SERVICIOS_LIST.length + EQUIPAMIENTO_LIST.length

/* ─── Manzana Modal (numpad + sub-tramo) ────────────────── */
function ManzanaModal({ current, onConfirm, onClose }) {
  const parts = current ? current.split('.') : ['', '']
  const [input, setInput] = useState(parts[0] || '')
  const [subPart, setSubPart] = useState(parts[1] || '')

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && validMain) onConfirm(fullValue)
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose, onConfirm, validMain, fullValue])

  const num = parseInt(input)
  const validMain = input !== '' && !isNaN(num) && num >= 1 && num <= 1000
  const fullValue = validMain ? (subPart ? `${num}.${subPart}` : String(num)) : ''

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
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-icon">{<IconHash />}</span>
            Número de Manzana
          </div>
          <button className="modal-close" onClick={onClose}><IconClose /></button>
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
              className={`numpad-key ${k === 'CLR' ? 'key-clear' : ''} ${k === 'DEL' ? 'key-del' : ''}`}
              onClick={() => press(k)}
              autoFocus={k === '1'}
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
function ServiceRow({ item, value, locked, isNext, onChange, children }) {
  const ref = useRef(null)
  const prevLocked = useRef(locked)

  useEffect(() => {
    if (prevLocked.current && !locked && ref.current) {
      ref.current.classList.add('row-pulse')
      setTimeout(() => ref.current?.classList.remove('row-pulse'), 700)
    }
    prevLocked.current = locked
  }, [locked])

  const sel = OPCIONES_SERVICIO.find(o => o.val === value)

  return (
    <div
      ref={ref}
      className={`fc-row ${locked ? (isNext ? 'row-next' : 'row-locked') : 'row-open'} ${value ? `row-filled row-filled-${sel?.color}` : ''}`}
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
            {OPCIONES_SERVICIO.map(opt => (
              <button
                key={opt.val}
                type="button"
                className={`row-opt opt-${opt.color} ${value === opt.val ? 'opt-active' : ''}`}
                onClick={() => onChange(item.key, opt.val)}
              >
                {value === opt.val && <IconCheck />}
                {opt.label}
              </button>
            ))}
          </div>
        )
      }

      {children}
    </div>
  )
}

/* ─── Equip Row ─────────────────────────────────────────── */
function EquipRow({ item, value, locked, isNext, onChange }) {
  const ref = useRef(null)
  const prevLocked = useRef(locked)

  useEffect(() => {
    if (prevLocked.current && !locked && ref.current) {
      ref.current.classList.add('row-pulse')
      setTimeout(() => ref.current?.classList.remove('row-pulse'), 700)
    }
    prevLocked.current = locked
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
            >
              {value === '1' && <IconCheck />} Sí hay
            </button>
            <button
              type="button"
              className={`row-opt opt-muted ${value === '0' ? 'opt-active' : ''}`}
              onClick={() => onChange(item.key, '0')}
            >
              {value === '0' && <IconCheck />} No hay
            </button>
          </div>
        )
      }
    </div>
  )
}

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
      <button ref={btnRef} type="button" className={`info-tip-btn${pos ? ' tip-open' : ''}`} onClick={toggle} aria-label="Ayuda">?</button>
      {pos && (
        <span
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

/* ─── Subtype Modal (infraestructura) ──────────────────── */
function SubtypeModal({ tipo, onConfirm, onCancel }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onCancel])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-icon" style={{ color: tipo.color }}>{tipo.icon}</span>
            Tipo de {tipo.label}
          </div>
          <button className="modal-close" onClick={onCancel}><IconClose /></button>
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
function MapClickCapture({ activeType, onPlace }) {
  const typeRef  = useRef(activeType)
  const placeRef = useRef(onPlace)

  useEffect(() => {
    typeRef.current  = activeType
    placeRef.current = onPlace
  }, [activeType, onPlace])

  useMapEvents({
    click(e) {
      placeRef.current({ id: Date.now(), lat: e.latlng.lat, lng: e.latlng.lng, type: typeRef.current })
    },
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

/* ─── Mapa Infraestructura Card ─────────────────────────── */
function MapaInfraestructura({ markers, onChange, blocked, blockReason, refMarkers = [] }) {
  const [activeType, setActiveType] = useState('luminaria')
  const [tileLayer, setTileLayer]   = useState('osm')
  const [flyTarget, setFlyTarget]   = useState(null)
  const [locating, setLocating]     = useState(false)
  const [locError, setLocError]     = useState(false)

  // Centrar en GPS automáticamente al cargar
  useEffect(() => {
    if (blocked) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setFlyTarget([pos.coords.latitude, pos.coords.longitude]),
      () => {}, // silencioso si el usuario rechaza
      { enableHighAccuracy: true, timeout: 10000 }
    )
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

  const [pendingMarker, setPendingMarker] = useState(null)

  const handleMapClick = useCallback((m) => {
    const tipo = INFRA_TIPOS.find(t => t.key === m.type)
    if (tipo?.subtypes?.length) {
      setPendingMarker(m)
    } else {
      onChange(prev => [...prev, m])
    }
  }, [onChange])

  const confirmSubtype = (subtypeKey) => {
    if (pendingMarker) {
      onChange(prev => [...prev, { ...pendingMarker, subtype: subtypeKey }])
      setPendingMarker(null)
    }
  }

  const removeMarker = (id) => onChange(prev => prev.filter(m => m.id !== id))

  const activeTipo = INFRA_TIPOS.find(t => t.key === activeType)

  const counts = INFRA_TIPOS.map(t => ({
    ...t,
    count: markers.filter(m => m.type === t.key).length,
  }))

  return (
    <div className={`mapa-card ${blocked ? 'card-blocked' : ''}`}>
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
          <p>{blocked ? (blockReason || 'Completa el formulario para acceder al mapa') : 'Toca el mapa para agregar elementos. Selecciona el tipo con los botones.'}</p>
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

      {/* Type selector buttons */}
      <div className="mapa-tipos">
        {INFRA_TIPOS.map(t => (
          <button
            key={t.key}
            type="button"
            className={`mapa-tipo-btn ${activeType === t.key ? 'mapa-tipo-active' : ''}`}
            style={activeType === t.key ? { background: t.bg, borderColor: t.border, color: t.color } : {}}
            onClick={() => setActiveType(t.key)}
          >
            <span className="mapa-tipo-icon">{t.icon}</span>
            <span className="mapa-tipo-label">{t.label}</span>
            {markers.filter(m => m.type === t.key).length > 0 && (
              <span
                className="mapa-tipo-count"
                style={{ background: t.color }}
              >
                {markers.filter(m => m.type === t.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cursor hint */}
      <div className="mapa-hint">
        <span className="mapa-hint-dot" style={{ background: activeTipo?.color }} />
        Toca el mapa para colocar <strong>{activeTipo?.label}</strong>
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
          <MapClickCapture activeType={activeType} onPlace={handleMapClick} />
          {/* Puntos ya registrados (referencia) */}
          {refMarkers.map((m, i) => (
            <Marker key={`ref-${i}`} position={[m.lat, m.lng]} icon={makeRefIcon(m.type)}>
              <Popup>
                <div className="mapa-popup">
                  <strong style={{ color: '#737373' }}>Manzana {m.manzana}</strong>
                  <span style={{ color: '#a3a3a3', fontSize: '11px' }}>{m.type}{m.subtype ? ` · ${m.subtype}` : ''}</span>
                  <span className="mapa-popup-coord"><b>UTM:</b> {toUTM(m.lat, m.lng).label}</span>
                </div>
              </Popup>
            </Marker>
          ))}
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
        >
          <IconLocate />
          {locating ? 'Buscando…' : locError ? 'Sin GPS' : 'Mi ubicación'}
        </button>
      </div>

      {/* Marker count summary */}
      <div className="mapa-resumen">
        {counts.map(t => (
          <div key={t.key} className="mapa-resumen-item" style={{ borderColor: t.border, background: t.bg }}>
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

/* ─── Main ──────────────────────────────────────────────── */
export default function FormCatastro({ onAdminClick, isAdmin = false }) {
  const [manzana, setManzana]           = useState('')
  const [showModal, setShowModal]       = useState(false)
  const [tipoVialidad, setTipoVialidad] = useState('')
  const [nombreVialidad, setNombreVialidad] = useState('')
  const [servicios, setServicios]       = useState(
    Object.fromEntries(SERVICIOS_LIST.map(s => [s.key, '']))
  )
  const [tipoPavimento, setTipoPavimento] = useState('')
  const [equipamiento, setEquipamiento] = useState(
    Object.fromEntries(EQUIPAMIENTO_LIST.map(e => [e.key, '']))
  )
  const [infraMarkers, setInfraMarkers]  = useState([])
  const [observaciones, setObservaciones] = useState('')
  const [editingId, setEditingId]        = useState(null)  // id del registro en edición
  const [recentList, setRecentList]     = useState(() => getRecent())
  const [toast, setToast]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [savedSummary, setSavedSummary] = useState(null)  // confirmación post-envío
  const [showQueue, setShowQueue]       = useState(false)
  const [queueTab, setQueueTab]         = useState('pending') // 'pending' | 'sent' | 'conflicts'
  const [sentList, setSentList]         = useState(() => getSent())
  const [isOnline, setIsOnline]           = useState(navigator.onLine)
  const [pendingCount, setPendingCount]   = useState(queueSize)
  const [isSyncing, setIsSyncing]         = useState(false)
  const [syncProgress, setSyncProgress]   = useState({ done: 0, total: 0 })
  const [lastSyncAt, setLastSyncAt]       = useState(null)
  const [bannersCollapsed, setBannersCollapsed] = useState(false)
  const [draft, setDraft] = useState(null)  // borrador a restaurar
  const draftLoadedRef = useRef(false)
  const [conflicts, setConflicts]         = useState(() => getConflicts())
  const [installPrompt, setInstallPrompt] = useState(null)
  const [refMarkers, setRefMarkers]     = useState([])
  const [registeredManzanas, setRegisteredManzanas] = useState([])
  const [showProgress, setShowProgress] = useState(false)
  const [mzSearch, setMzSearch]         = useState('')
  // Cache stores { manzana, data } so manzanaDup and checkingManzana are fully derived —
  // no synchronous setState needed in effects.
  const [manzanaDupCache, setManzanaDupCache] = useState(null)
  const manzanaDup = manzanaDupCache?.manzana === manzana ? manzanaDupCache.data : null
  const checkingManzana = Boolean(manzana && isConfigured && supabase && manzanaDupCache?.manzana !== manzana)

  const seccion1Completa   = manzana !== '' && !checkingManzana && tipoVialidad !== '' && nombreVialidad.trim() !== ''
  const serviciosCompletos = SERVICIOS_LIST.every(s => servicios[s.key] !== '')
  const equipamientoCompleto = EQUIPAMIENTO_LIST.every(e => equipamiento[e.key] !== '')

  const serviciosUnlocked = useMemo(() => {
    let c = 1
    for (let i = 0; i < SERVICIOS_LIST.length - 1; i++) {
      if (servicios[SERVICIOS_LIST[i].key] !== '') c++; else break
    }
    return c
  }, [servicios])

  const equipamientoUnlocked = useMemo(() => {
    let c = 1
    for (let i = 0; i < EQUIPAMIENTO_LIST.length - 1; i++) {
      if (equipamiento[EQUIPAMIENTO_LIST[i].key] !== '') c++; else break
    }
    return c
  }, [equipamiento])

  const subtotalServicios = useMemo(() =>
    SERVICIOS_LIST.reduce((s, item) => {
      const v = servicios[item.key]
      return v ? s + (OPCIONES_SERVICIO.find(o => o.val === v)?.peso ?? 0) : s
    }, 0), [servicios])

  const subtotalEquipamiento = useMemo(() =>
    EQUIPAMIENTO_LIST.reduce((s, item) => {
      const v = equipamiento[item.key]
      return v !== '' ? s + Number(v) : s
    }, 0), [equipamiento])

  const total = subtotalServicios + subtotalEquipamiento

  const completedFields =
    (manzana ? 1 : 0) + (tipoVialidad ? 1 : 0) + (nombreVialidad.trim() ? 1 : 0) +
    SERVICIOS_LIST.filter(s => servicios[s.key] !== '').length +
    EQUIPAMIENTO_LIST.filter(e => equipamiento[e.key] !== '').length
  const progressPct = Math.round((completedFields / TOTAL_FIELDS) * 100)

  const toastTimer    = useRef(null)
  const undoRef       = useRef(null)
  const undoTimer     = useRef(null)
  const loadGenRef    = useRef(0)
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
        setPendingCount(queueSize())
      }
      if (data.dbId && isConfigured && supabase) {
        await supabase.from('registros').delete().eq('id', data.dbId)
      }
      showToast('Envío deshecho')
    } catch {
      showToast('Error al deshacer — revisa la cola offline')
    }
  }

  const showToast = (msg) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  // Cargar borrador al montar (solo una vez)
  useEffect(() => {
    if (draftLoadedRef.current) return
    draftLoadedRef.current = true
    const d = loadDraft()
    if (d && !editingId) setDraft(d)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update queue count and conflicts once IndexedDB finishes loading
  useEffect(() => {
    onQueueReady(({ queue, conflicts: c, sent: s }) => {
      setPendingCount(queue.length)
      setConflicts(c)
      setSentList(s ?? [])
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-guardar borrador con debounce de 1.5s
  useEffect(() => {
    if (editingId) return  // No guardar borrador en modo edición
    const hasData = manzana || nombreVialidad.trim() ||
      Object.values(servicios).some(v => v !== '') ||
      Object.values(equipamiento).some(v => v !== '') ||
      infraMarkers.length > 0 || observaciones.trim()
    if (!hasData) { clearDraft(); return }
    const t = setTimeout(() => {
      saveDraft({ manzana, tipoVialidad, nombreVialidad, servicios, tipoPavimento, equipamiento, infraMarkers, observaciones, _at: Date.now() })
    }, 1500)
    return () => clearTimeout(t)
  }, [manzana, tipoVialidad, nombreVialidad, servicios, tipoPavimento, equipamiento, infraMarkers, observaciones, editingId])

  useEffect(() => {
    if (!manzana || !isConfigured || !supabase) return
    let cancelled = false
    const timer = setTimeout(() => {
      supabase
        .from('registros')
        .select('manzana')
        .eq('manzana', manzana)
        .limit(1)
        .then(({ data }) => {
          if (cancelled) return
          if (data?.length && !editingId) {
            showToast(`La manzana ${manzana} ya está registrada — selecciona otra`)
            setManzana('')
            setManzanaDupCache(null)
          } else {
            setManzanaDupCache({ manzana, data: null })
          }
        })
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [manzana, editingId])

  const prevS1    = useRef(false)
  const prevS2    = useRef(false)
  const seccion2Ref = useRef(null)
  const equipRef    = useRef(null)

  useEffect(() => {
    if (!prevS1.current && seccion1Completa) {
      showToast('Sección 1 completa')
      setTimeout(() => seccion2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
    }
    prevS1.current = seccion1Completa
  }, [seccion1Completa])

  useEffect(() => {
    if (!prevS2.current && serviciosCompletos) {
      showToast('Servicios completados')
      setTimeout(() => equipRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
    }
    prevS2.current = serviciosCompletos
  }, [serviciosCompletos])

  // Cargar puntos ya registrados como referencia en el mapa
  useEffect(() => {
    if (!isConfigured || !supabase) return
    let mounted = true
    supabase.from('registros').select('manzana, infra_mapa').then(({ data, error }) => {
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
      .order('manzana', { ascending: true })
      .then(({ data }) => { if (data) setRegisteredManzanas(data) })
  }, [])

  useEffect(() => {
    fetchRegisteredManzanas()
    if (!isConfigured || !supabase) return
    const ch = supabase.channel('manzanas-progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros' },
        () => fetchRegisteredManzanas())
      .subscribe()
    return () => { ch.unsubscribe(); supabase.removeChannel(ch) }
  }, [fetchRegisteredManzanas])

  const syncOfflineQueue = useCallback(async function syncOfflineQueue() {
    if (!isConfigured || !supabase) return
    const queue = getQueue()
    if (!queue.length) return
    setIsSyncing(true)
    setSyncProgress({ done: 0, total: queue.length })
    let synced = 0
    let newConflicts = 0
    let stuck = 0
    try {
      for (const item of queue) {
        const { _qid, _at, _folio, _retries, _status, ...record } = item
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
        setSyncProgress({ done: synced + newConflicts + stuck, total: queue.length })
      }
      if (stuck > 0 && synced === 0 && newConflicts === 0) {
        showToast(`Error del servidor — ${stuck} registro${stuck > 1 ? 's' : ''} sin enviar, se reintentará`)
      } else if (synced > 0 && newConflicts === 0 && stuck === 0) {
        showToast(`${synced} registro${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''}`)
      } else if (synced > 0 && newConflicts > 0 && stuck === 0) {
        showToast(`${synced} sincronizado${synced > 1 ? 's' : ''} — ${newConflicts} conflicto${newConflicts > 1 ? 's' : ''}`)
      } else if (newConflicts > 0 && synced === 0 && stuck === 0) {
        showToast(`${newConflicts} manzana${newConflicts > 1 ? 's' : ''} ya registrada${newConflicts > 1 ? 's' : ''} por otro capturista`)
      } else if (stuck > 0) {
        showToast(`${synced > 0 ? `${synced} enviado${synced > 1 ? 's' : ''} — ` : ''}${stuck} sin enviar por error del servidor`)
      }
    } catch {
      showToast('Error inesperado durante sincronización')
    } finally {
      setConflicts(getConflicts())
      setPendingCount(queueSize())
      setIsSyncing(false)
      if (synced > 0 || newConflicts > 0) setLastSyncAt(new Date().toISOString())
    }
  }, [])

  // Online / offline detection
  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  syncOfflineQueue() }
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (navigator.onLine && queueSize() > 0) syncOfflineQueue()
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [syncOfflineQueue])

  // Escape para cerrar modales inline
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape') return
      if (savedSummary) { setSavedSummary(null); return }
      if (showQueue)    { setShowQueue(false);    return }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [savedSummary, showQueue])

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
    setServicios(Object.fromEntries(SERVICIOS_LIST.map(s => [s.key, ''])))
    setTipoPavimento('')
    setEquipamiento(Object.fromEntries(EQUIPAMIENTO_LIST.map(e => [e.key, ''])))
    setInfraMarkers([])
    setObservaciones('')
    setToast(''); setSaving(false); setManzanaDupCache(null); setEditingId(null)
    clearDraft()
    setDraft(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleRestoreDraft = () => {
    if (!draft) return
    setManzana(draft.manzana ?? '')
    setTipoVialidad(draft.tipoVialidad ?? '')
    setNombreVialidad(draft.nombreVialidad ?? '')
    setServicios(draft.servicios ?? Object.fromEntries(SERVICIOS_LIST.map(s => [s.key, ''])))
    setTipoPavimento(draft.tipoPavimento ?? '')
    setEquipamiento(draft.equipamiento ?? Object.fromEntries(EQUIPAMIENTO_LIST.map(e => [e.key, ''])))
    setInfraMarkers(Array.isArray(draft.infraMarkers) ? draft.infraMarkers : [])
    setObservaciones(draft.observaciones ?? '')
    setDraft(null)
    clearDraft()
    showToast('Borrador restaurado')
  }

  async function handleLoadByManzana(manzanaNum) {
    if (!isConfigured || !supabase) return
    const myGen = ++loadGenRef.current
    setSaving(true)
    try {
      const { data } = await supabase.from('registros').select('*').eq('manzana', manzanaNum).limit(1).single()
      if (myGen !== loadGenRef.current) return  // Reset was called while loading
      setManzana(manzanaNum)
      if (!data) return
      setEditingId(data.id)
      setTipoVialidad(data.tipo_vialidad ?? '')
      setNombreVialidad(data.nombre_vialidad ?? '')
      setServicios({ ...data.servicios })
      setEquipamiento({ ...data.equipamiento })
      setTipoPavimento(data.tipo_pavimento ?? '')
      setInfraMarkers(Array.isArray(data.infra_mapa) ? data.infra_mapa : [])
      setObservaciones(data.observaciones ?? '')
      setManzanaDupCache({ manzana: manzanaNum, data: null })
      showToast('Editando manzana ' + manzanaNum)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      if (myGen !== loadGenRef.current) return
      showToast('Error al cargar el registro')
    } finally {
      if (myGen === loadGenRef.current) setSaving(false)
    }
  }

  const saveOffline = async (record, formSnap, label) => {
    try {
      const item = await enqueue(record)
      setPendingCount(queueSize())
      addRecent(record)
      setRecentList(getRecent())
      setSavedSummary({ ...record, _offline: true, _folio: item._folio })
      showUndoSnack(label, { formState: formSnap, qid: item._qid, dbId: null })
      handleReset()
    } catch {
      showToast('Error al guardar localmente — intenta de nuevo')
    }
  }

  const handleSubmit = async () => {
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
      tipoPavimento, equipamiento: {...equipamiento}, infraMarkers: [...infraMarkers], observaciones }

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
      const { error } = await supabase.from('registros').update(record).eq('id', editingId)
      setSaving(false)
      if (error) { showToast('Error al actualizar: ' + error.message); return }
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

    // Online insert — verificar duplicado antes (cubre race conditions)
    setSaving(true)
    const { data: existing } = await supabase
      .from('registros').select('manzana').eq('manzana', manzana).limit(1)
    if (existing?.length) {
      setSaving(false)
      showToast(`La manzana ${manzana} ya está registrada — selecciona otra`)
      setManzana('')
      setManzanaDupCache(null)
      return
    }
    const folio = `FOL-${String(manzana).padStart(3, '0')}-${Date.now().toString(36).slice(-4).toUpperCase()}`
    const { data: inserted, error } = await supabase.from('registros').insert([record]).select('id').single()
    setSaving(false)
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
      {showModal && (
        <ManzanaModal
          current={manzana}
          onConfirm={v => { setManzana(v); setShowModal(false) }}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Confirmación post-envío ── */}
      {savedSummary && (
        <div className="modal-overlay" onClick={() => setSavedSummary(null)}>
          <div className="saved-summary" onClick={e => e.stopPropagation()}>
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
              <div className="saved-folio">{savedSummary._folio}</div>
            )}
            {savedSummary.total != null && (
              <div className="saved-score">
                <span className="saved-score-val">{Number(savedSummary.total).toFixed(2)}</span>
                <span className="saved-score-lbl">pts totales</span>
              </div>
            )}
            <button className="saved-summary-btn" onClick={() => setSavedSummary(null)}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal progreso manzanas ── */}
      {showProgress && (() => {
        const queuedMz = getQueue().filter(q => !registeredManzanas.some(m => m.manzana === q.manzana))
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
          <div className="modal-overlay" onClick={() => { setShowProgress(false); setMzSearch('') }}>
            <div className="mz-progress-sheet" onClick={e => e.stopPropagation()}>
              <div className="mz-ps-header">
                <span>Manzanas capturadas ({allMz.length})</span>
                <button className="modal-close" onClick={() => { setShowProgress(false); setMzSearch('') }}><IconClose /></button>
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
                        handleLoadByManzana(mz.manzana)
                        setShowProgress(false)
                        setMzSearch('')
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
      })()}

      {/* ── Modal de registros (pendientes / enviados / conflictos) ── */}
      {showQueue && (
        <div className="modal-overlay" onClick={() => setShowQueue(false)}>
          <div className="queue-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title"><IconClipboard /> Mis registros</div>
              <button className="modal-close" onClick={() => setShowQueue(false)}><IconClose /></button>
            </div>

            {/* Tabs */}
            <div className="queue-tabs">
              {[
                { id: 'pending',   label: 'Pendientes', count: getQueue().length },
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

            {/* Pendientes */}
            {queueTab === 'pending' && (
              <div className="queue-list">
                {getQueue().length === 0
                  ? <p className="queue-empty">Sin registros pendientes.</p>
                  : getQueue().map(item => (
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

            {/* Enviados */}
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

            {/* Conflictos */}
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

            {queueTab === 'pending' && getQueue().length > 0 && isOnline && (
              <button className="queue-sync-btn" onClick={() => { syncOfflineQueue(); setShowQueue(false) }}>
                <IconSync /> Sincronizar ahora
              </button>
            )}
          </div>
        </div>
      )}

      {toast && <div className="fc-toast" role="status">{toast}</div>}
      {undoSnack && (
        <div className="fc-undo-snack" role="status">
          <span>{undoSnack}</span>
          <button className="fc-undo-btn" onClick={handleUndo}>Deshacer</button>
          <button className="fc-undo-dismiss" aria-label="Cerrar aviso" onClick={() => { clearTimeout(undoTimer.current); setUndoSnack(null) }}>✕</button>
        </div>
      )}

      {/* ── Banners section ── */}
      {(() => {
        const activeBannerCount = [
          !isOnline,
          isOnline && pendingCount > 0,
          conflicts.length > 0,
          Boolean(draft && !editingId),
          Boolean(installPrompt),
        ].filter(Boolean).length
        const showToggle = activeBannerCount >= 3
        return (
          <>
            {showToggle && (
              <button className="banners-toggle" onClick={() => setBannersCollapsed(c => !c)}>
                {bannersCollapsed ? `${activeBannerCount} avisos activos — ver todos` : 'Colapsar avisos'}
              </button>
            )}
            <div className={showToggle && bannersCollapsed ? 'fc-banners fc-banners--collapsed' : 'fc-banners'}>
              {/* Offline banner */}
              {!isOnline && (
                <div className="offline-banner">
                  <span className="offline-dot" /> Sin internet — los registros se guardarán localmente
                </div>
              )}

              {/* Pending sync banner */}
              {isOnline && pendingCount > 0 && (
                <div className="sync-banner">
                  {isSyncing ? (
                    <span className="sync-banner-label sync-banner-label--syncing">
                      <IconSync /> Sincronizando {syncProgress.done}/{syncProgress.total}…
                    </span>
                  ) : (
                    <button className="sync-banner-label" onClick={() => setShowQueue(true)}>
                      <IconSync /> {pendingCount} registro{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''} de sincronizar
                      {lastSyncAt && <span className="sync-last"> · {relativeTime(lastSyncAt)}</span>}
                    </button>
                  )}
                  {isSyncing ? (
                    <div className="fc-sync-bar">
                      <div className="fc-sync-bar-fill" style={{ width: `${syncProgress.total ? Math.round((syncProgress.done / syncProgress.total) * 100) : 0}%` }} />
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

      <div className="fc-topbar">
        <div className="fc-topbar-inner">
          <div className="fc-topbar-brand">
            <IconAppLogo size={26} />
            <span>Catastro</span>
          </div>
          <div className="fc-topbar-progress">
            <div className="fc-topbar-track">
              <div className="fc-topbar-fill" style={{ width: `${progressPct}%`, background: progressPct === 100 ? '#22c55e' : undefined }} />
            </div>
            <span style={progressPct === 100 ? { color: '#22c55e' } : undefined}>{progressPct === 100 ? <IconCheck /> : `${progressPct}%`}</span>
          </div>
          <div className="fc-topbar-right">
            {!isOnline && <span className="topbar-offline-badge">Offline</span>}
            {isOnline && pendingCount > 0 && <button className="topbar-pending-badge" onClick={() => setShowQueue(true)}>{pendingCount}</button>}
            {registeredManzanas.length > 0 && (
              <button className="fc-mz-count-btn" onClick={() => setShowProgress(true)}>
                {registeredManzanas.length} mz
              </button>
            )}
            <button className="fc-admin-btn" onClick={onAdminClick}><IconLock /> Admin</button>
          </div>
        </div>
      </div>

      <form className="fc-form" onSubmit={e => { e.preventDefault(); if (!saving) handleSubmit() }}>
        {/* Hero */}
        <div className="fc-hero">
          <div className="fc-hero-brand">
            <IconAppLogo size={48} />
            <div>
              <h1>Catastro</h1>
              <p>Captura de Servicios e Infraestructura</p>
            </div>
          </div>
          <div className="fc-steps">
            {[
              { label: 'Identificación', done: seccion1Completa, active: !seccion1Completa },
              { label: 'Servicios',      done: serviciosCompletos, active: seccion1Completa && !serviciosCompletos },
              { label: 'Equipamiento',   done: equipamientoCompleto, active: serviciosCompletos && !equipamientoCompleto },
            ].map((step, i) => (
              <span key={i} className={`fc-step ${step.done ? 'step-done' : step.active ? 'step-active' : ''}`}>
                <span className="step-num">{step.done ? <IconCheck /> : i + 1}</span>
                {step.label}
                {i < 2 && <span className="step-sep" />}
              </span>
            ))}
          </div>
        </div>

        {/* ── Historial reciente ── */}
        {recentList.length > 0 && !editingId && (
          <div className="recent-section">
            <div className="recent-label">Capturas recientes</div>
            <div className="recent-list">
              {recentList.map(r => (
                <button
                  key={r.manzana + r.at}
                  type="button"
                  className="recent-chip"
                  onClick={() => handleLoadByManzana(r.manzana)}
                  disabled={saving}
                >
                  <span className="recent-chip-mz">Mz {r.manzana}</span>
                  <span className="recent-chip-via">{TIPOS_VIALIDAD.find(t => t.code === r.tipo_vialidad)?.label ?? r.tipo_vialidad} {r.nombre_vialidad}</span>
                  <span className="recent-chip-meta">
                    {r.total != null && <span className="recent-chip-score">{Number(r.total).toFixed(2)}</span>}
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
              <label><span className="field-icon"><IconHash /></span> Manzana <InfoTooltip text={"Número del plano catastral.\nFormato X.Y:\n  X = zona   Y = número en la zona\n\nEjemplos: 1.1 · 2.4 · 10.3"} /></label>
              <button
                type="button"
                className={`manzana-trigger ${manzana ? 'has-value' : ''} ${manzanaDup ? 'manzana-trigger-dup' : ''}`}
                onClick={() => setShowModal(true)}
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
            </div>

            {/* Tipo Vialidad */}
            <div className="fc-field">
              <label><span className="field-icon"><IconRoadType /></span> Tipo de Vialidad <InfoTooltip text={"Vía que bordea la manzana:\nCAL = Calle\nAVE = Avenida\nBLV = Boulevard\nCJN = Callejón\nCDA = Cerrada\nCZA = Calzada\nCAR = Carretera"} /></label>
              <div className="vial-grid">
                {TIPOS_VIALIDAD.map(t => (
                  <button
                    key={t.code}
                    type="button"
                    className={`vial-btn ${tipoVialidad === t.code ? 'active' : ''}`}
                    onClick={() => setTipoVialidad(t.code)}
                  >
                    <span className="vial-code">{t.code}</span>
                    <span className="vial-name">{t.label}</span>
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
                  autoComplete="street-address"
                />
                {nombreVialidad.trim() && <span className="input-ok"><IconCheck /></span>}
              </div>
            </div>
          </div>
        </div>

        {/* ══ Card 2 ══ */}
        <div ref={seccion2Ref} className={`fc-card ${!seccion1Completa ? 'card-blocked' : ''} ${serviciosCompletos ? 'card-done' : ''}`}>
          <div className="card-head">
            <span className="card-num" style={!seccion1Completa ? { background: '#e5e5e5', color: '#a3a3a3' } : {}}>
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
                {SERVICIOS_LIST.map((item, idx) => {
                  const locked = idx >= serviciosUnlocked
                  return (
                    <ServiceRow
                      key={item.key}
                      item={item}
                      value={servicios[item.key]}
                      locked={locked}
                      isNext={idx === serviciosUnlocked}
                      onChange={(k, v) => {
                        setServicios(p => ({ ...p, [k]: v }))
                        if (k === 'pavimento' && v === 'N') setTipoPavimento('')
                      }}
                    >
                      {item.hasTipo && servicios[item.key] && servicios[item.key] !== 'N' && (
                        <div className="pav-subfield">
                          <span className="pav-label">Tipo de pavimento <InfoTooltip text={"Material predominante:\nAD = Adoquín\nHI = Concreto hidráulico\nAS = Asfalto\nEM = Empedrado\nTE = Terracería\nTI = Tierra"} /></span>
                          <div className="pav-grid">
                            {TIPOS_PAVIMENTO.map(tp => (
                              <button
                                key={tp.code}
                                type="button"
                                className={`pav-btn ${tipoPavimento === tp.code ? 'active' : ''}`}
                                onClick={() => setTipoPavimento(tp.code)}
                              >
                                <b>{tp.code}</b><span>{tp.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </ServiceRow>
                  )
                })}
              </div>

              {/* Equipamiento subsection */}
              <div ref={equipRef} className={`equip-section ${!serviciosCompletos ? 'equip-locked' : ''}`}>
                <div className="equip-head">
                  <h3>Equipamiento Urbano <InfoTooltip text={"¿Existe dentro o cerca de la manzana?\nSí hay = presente y accesible (+1 pt)\nNo hay = ausente o inaccesible\n\nEl total suma al puntaje final."} /></h3>
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
                      {EQUIPAMIENTO_LIST.map((item, idx) => (
                        <EquipRow
                          key={item.key}
                          item={item}
                          value={equipamiento[item.key]}
                          locked={idx >= equipamientoUnlocked}
                          isNext={idx === equipamientoUnlocked}
                          onChange={(k, v) => setEquipamiento(p => ({ ...p, [k]: v }))}
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
                <b>{SERVICIOS_LIST.filter(s => servicios[s.key]).length} / {SERVICIOS_LIST.length}</b>
              </div>
              <div>
                <span>Equipamiento respondido</span>
                <b>{EQUIPAMIENTO_LIST.filter(e => equipamiento[e.key] !== '').length} / {EQUIPAMIENTO_LIST.length}</b>
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
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Escribe aquí cualquier observación relevante sobre la manzana, sus calles o condiciones especiales…"
                  rows={4}
                  aria-label="Observaciones"
                />
                {observaciones.trim() && (
                  <div className="obs-char-count">{observaciones.trim().length} caracteres</div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn-submit"
              disabled={saving}
            >
              {saving
                ? <><span className="btn-spinner" aria-hidden="true"/> {editingId ? 'Actualizando…' : 'Guardando…'}</>
                : (editingId ? 'Actualizar registro' : 'Guardar registro')}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
