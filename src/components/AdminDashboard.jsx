import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area,
  PieChart, Pie, Cell,
} from 'recharts'
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import * as XLSX from 'xlsx'
import { supabase, isConfigured } from '../lib/supabase'
import { toUTM } from '../utils/utm'
import './AdminDashboard.css'

const PIN_COLORS = { luminaria: '#f59e0b', alcantarilla: '#2563eb', inmueble: '#dc2626', agua: '#0ea5e9' }
const PAGE_SIZE_DEFAULT = 20

function relativeDate(iso) {
  const d      = new Date(iso)
  const now    = new Date()
  const diffMs = now - d
  const diffM  = Math.floor(diffMs / 60000)
  const diffH  = Math.floor(diffMs / 3600000)
  const diffD  = Math.floor(diffMs / 86400000)
  const hm     = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  if (diffM  <  2) return 'Ahora'
  if (diffM  < 60) return `Hace ${diffM} min`
  if (diffH  < 24) return `Hoy ${hm}`
  if (diffD === 1) return `Ayer ${hm}`
  if (diffD  <  7) return `Hace ${diffD} días`
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '.78rem',
    padding: '.5rem .75rem',
    boxShadow: '0 4px 16px rgba(0,0,0,.1)',
  },
  labelStyle: { fontWeight: 700, color: 'var(--ink)', marginBottom: '.2rem' },
  itemStyle:  { color: 'var(--ink-2)', padding: '2px 0' },
  cursor:     { fill: 'rgba(99,102,241,.06)' },
}

function makePinIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  })
}

function makeScoreIcon(score) {
  const color = score >= 12 ? '#15803d' : score >= 8 ? '#6366f1' : '#b45309'
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  })
}

const SERVICIOS_LIST = [
  { key: 'aguaPotable',       label: 'Agua Potable' },
  { key: 'drenaje',           label: 'Drenaje' },
  { key: 'alcantarillado',    label: 'Alcantarillado' },
  { key: 'electrificacion',   label: 'Electrificación' },
  { key: 'guarniciones',      label: 'Guarniciones' },
  { key: 'banquetas',         label: 'Banquetas' },
  { key: 'pavimento',         label: 'Pavimento' },
  { key: 'recoleccionBasura', label: 'Basura' },
]
const SERVICIOS_FULL = [
  { key: 'aguaPotable',       label: 'Agua Potable' },
  { key: 'drenaje',           label: 'Drenaje' },
  { key: 'alcantarillado',    label: 'Alcantarillado' },
  { key: 'electrificacion',   label: 'Electrificación' },
  { key: 'guarniciones',      label: 'Guarniciones' },
  { key: 'banquetas',         label: 'Banquetas' },
  { key: 'pavimento',         label: 'Pavimento' },
  { key: 'recoleccionBasura', label: 'Recolección de Basura' },
]

const EQUIPAMIENTO_LIST = [
  { key: 'educacionCultura',  label: 'Educación' },
  { key: 'transportePublico', label: 'Transporte' },
  { key: 'comercioAbasto',    label: 'Comercio' },
  { key: 'recreacionDeporte', label: 'Deporte' },
  { key: 'saludAsistencia',   label: 'Salud' },
  { key: 'telefono',          label: 'Teléfono' },
  { key: 'correosYTelegrafo', label: 'Correos' },
  { key: 'contaminacion',     label: 'Contaminación' },
  { key: 'calleEspecial',     label: 'C. Especial' },
]
const EQUIPAMIENTO_FULL = [
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

const OPCIONES = [
  { val: 'B', label: 'Bueno',   color: '#15803d' },
  { val: 'R', label: 'Regular', color: '#b45309' },
  { val: 'M', label: 'Malo',    color: '#b91c1c' },
  { val: 'N', label: 'Ninguno', color: '#a3a3a3' },
]

const TIPOS_VIALIDAD = [
  { code: 'AVE', label: 'Avenida' }, { code: 'BLV', label: 'Boulevard' },
  { code: 'CAL', label: 'Calle' },   { code: 'CJN', label: 'Callejón' },
  { code: 'CDA', label: 'Cerrada' }, { code: 'CZA', label: 'Calzada' },
  { code: 'CAR', label: 'Carretera' },
]

const TIPO_LABELS = Object.fromEntries(TIPOS_VIALIDAD.map(t => [t.code, t.label]))

const TIPOS_PAVIMENTO = [
  { code: 'AD', label: 'Adoquín' },
  { code: 'HI', label: 'Concreto Hidráulico' },
  { code: 'AS', label: 'Asfalto' },
  { code: 'EM', label: 'Empedrado' },
  { code: 'TE', label: 'Terracería' },
  { code: 'TI', label: 'Tierra' },
]

/* ── Icon system ── */
function Icon({ name, size = 16, className, style }) {
  const d = {
    close:      <><line x1="4.5" y1="4.5" x2="11.5" y2="11.5"/><line x1="11.5" y1="4.5" x2="4.5" y2="11.5"/></>,
    edit:       <><path d="M11.5 3.5L13 5L7 11H5V9L11.5 3.5Z"/><line x1="9.5" y1="5.5" x2="11" y2="7"/></>,
    refresh:    <><path d="M13.5 8A5.5 5.5 0 0 1 3.5 11.5"/><path d="M2.5 8A5.5 5.5 0 0 1 12.5 4.5"/><polyline points="13.5,5 13.5,8.5 10,8.5"/><polyline points="2.5,11 2.5,7.5 6,7.5"/></>,
    download:   <><line x1="8" y1="3" x2="8" y2="11"/><polyline points="5,8 8,11 11,8"/><line x1="3" y1="13.5" x2="13" y2="13.5"/></>,
    warning:    <><polygon points="8,2 14.5,13.5 1.5,13.5"/><line x1="8" y1="7" x2="8" y2="10.5"/><circle cx="8" cy="12" r="0.65" fill="currentColor" stroke="none"/></>,
    offline:    <><line x1="2" y1="2" x2="14" y2="14"/><path d="M5 5A7 7 0 0 0 14 10"/><path d="M10.8 10.8A3 3 0 0 0 7 7"/><circle cx="8" cy="13.5" r="1" fill="currentColor" stroke="none"/></>,
    lightning:  <><path d="M9.5 2L5 9.5H8.5L6.5 14L12 6.5H8.5L9.5 2Z"/></>,
    calendar:   <><rect x="2" y="3.5" width="12" height="11" rx="1.5"/><line x1="2" y1="7.5" x2="14" y2="7.5"/><line x1="5.5" y1="1.5" x2="5.5" y2="5.5"/><line x1="10.5" y1="1.5" x2="10.5" y2="5.5"/></>,
    table:      <><rect x="2" y="2" width="12" height="12" rx="1.5"/><line x1="2" y1="6.5" x2="14" y2="6.5"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="7" y1="6.5" x2="7" y2="14"/></>,
    grid:       <><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></>,
    satellite:  <><circle cx="5.5" cy="10.5" r="2"/><line x1="7" y1="9" x2="8.5" y2="7.5"/><line x1="10" y1="3" x2="13" y2="6"/><line x1="12.5" y1="3.5" x2="10.5" y2="5.5"/><line x1="10.5" y1="5.5" x2="12.5" y2="7.5"/><line x1="5.5" y1="8.5" x2="9.5" y2="4.5"/><line x1="7.5" y1="10.5" x2="11.5" y2="6.5"/></>,
    map:        <><polygon points="1.5,3 6,1.5 10,3.5 14.5,2 14.5,14 10,15.5 6,13.5 1.5,15"/><line x1="6" y1="1.5" x2="6" y2="13.5"/><line x1="10" y1="3.5" x2="10" y2="15.5"/></>,
    back:       <><polyline points="9,4.5 4,8 9,11.5"/><line x1="4" y1="8" x2="13" y2="8"/></>,
    logout:     <><path d="M9 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h6"/><polyline points="11.5,11 14.5,8 11.5,5"/><line x1="14.5" y1="8" x2="6" y2="8"/></>,
    printer:    <><polyline points="5,8 5,2 11,2 11,8"/><path d="M2 8h12a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2"/><path d="M5 13H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1"/><rect x="5" y="12" width="6" height="4" rx="0.5"/></>,
    check:      <><polyline points="2.5,8 6,11.5 13.5,4.5"/></>,
    barChart:   <><rect x="2" y="9.5" width="3" height="4.5"/><rect x="6.5" y="6.5" width="3" height="7.5"/><rect x="11" y="3.5" width="3" height="10.5"/><line x1="2" y1="14.5" x2="14" y2="14.5"/></>,
    list:       <><line x1="3" y1="5" x2="13" y2="5"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="11" x2="13" y2="11"/></>,
    arrowUp:    <><line x1="8" y1="13" x2="8" y2="3"/><polyline points="4.5,6.5 8,3 11.5,6.5"/></>,
    arrowDown:  <><line x1="8" y1="3" x2="8" y2="13"/><polyline points="4.5,9.5 8,13 11.5,9.5"/></>,
    arrowRight: <><line x1="3" y1="8" x2="13" y2="8"/><polyline points="9.5,4.5 13,8 9.5,11.5"/></>,
    filter:     <><line x1="2.5" y1="4.5" x2="13.5" y2="4.5"/><line x1="4.5" y1="8" x2="11.5" y2="8"/><line x1="6.5" y1="11.5" x2="9.5" y2="11.5"/></>,
    dot:        <circle cx="8" cy="8" r="4.5" fill="currentColor" stroke="none"/>,
    search:     <><circle cx="7" cy="7" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></>,
    pin:        <><path d="M8 2a4 4 0 0 1 4 4c0 3-4 8-4 8S4 9 4 6a4 4 0 0 1 4-4Z"/><circle cx="8" cy="6" r="1.5" fill="white" stroke="none"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={className} style={style}>
      {d[name]}
    </svg>
  )
}

/* ── Info Tooltip ── */
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
    const W = 244
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

/* ── useCountUp — animates numbers from 0 to target ── */
function useCountUp(target, duration = 700) {
  const [display, setDisplay] = useState(target === '—' ? '—' : 0)
  useEffect(() => {
    if (target === '—') { setDisplay('—'); return }
    const num = parseFloat(target)
    if (isNaN(num)) { setDisplay(target); return }
    const isInt = Number.isInteger(num) && !String(target).includes('.')
    const decimals = isInt ? 0 : (String(target).split('.')[1] || '').length
    let rafId, start = null
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      const cur = num * ease
      setDisplay(decimals > 0 ? cur.toFixed(decimals) : Math.round(cur))
      if (p < 1) { rafId = requestAnimationFrame(step) }
    }
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration])
  return display
}

/* ── Stat card ── */
function StatCard({ value, label, sub, color, tip, icon }) {
  const animated = useCountUp(value)
  return (
    <div className="ad-card" style={color ? { '--card-color': color } : {}}>
      {icon && <div className="ad-card-icon"><Icon name={icon} size={20}/></div>}
      <div className="ad-card-val">{animated}</div>
      <div className="ad-card-lbl">{label}{tip && <InfoTooltip text={tip} />}</div>
      {sub && <div className="ad-card-sub">{sub}</div>}
    </div>
  )
}

/* ── Export CSV ── */
function exportCSV(records) {
  const headers = [
    'Fecha', 'Manzana', 'Tipo Vialidad', 'Nombre Vialidad',
    ...SERVICIOS_FULL.map(s => `Serv_${s.label}`),
    ...EQUIPAMIENTO_FULL.map(e => `Equip_${e.label}`),
    'Subtotal Servicios', 'Subtotal Equipamiento', 'Total', 'Observaciones',
  ]
  const rows = records.map(r => [
    new Date(r.created_at).toLocaleDateString('es-MX'),
    r.manzana,
    TIPO_LABELS[r.tipo_vialidad] ?? r.tipo_vialidad,
    r.nombre_vialidad,
    ...SERVICIOS_FULL.map(s => r.servicios?.[s.key] ?? ''),
    ...EQUIPAMIENTO_FULL.map(e => r.equipamiento?.[e.key] === '1' ? 'Sí' : r.equipamiento?.[e.key] === '0' ? 'No' : ''),
    Number(r.subtotal_servicios).toFixed(4),
    r.subtotal_equipamiento,
    Number(r.total).toFixed(4),
    r.observaciones ?? '',
  ])
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: `catastro_${new Date().toISOString().slice(0,10)}.csv` }).click()
  URL.revokeObjectURL(url)
}

/* ── Export DXF (AutoCAD) ── */
function exportDXF(records, onError, onSuccess) {
  const pts = []
  records.forEach(r => {
    if (!Array.isArray(r.infra_mapa)) return
    r.infra_mapa.forEach(m => {
      const utm = toUTM(m.lat, m.lng)
      pts.push({
        x:      utm.easting,
        y:      utm.northing,
        layer:  (m.type || 'INFRA').toUpperCase(),
        label:  `MZ${r.manzana}-${(m.type||'').toUpperCase()}${m.subtype ? '-' + m.subtype.toUpperCase() : ''}`,
      })
    })
  })

  if (!pts.length) { if (onError) onError('Sin puntos de infraestructura para exportar'); return }

  const layers   = [...new Set(pts.map(p => p.layer))]
  const COLORS   = { LUMINARIA: 2, ALCANTARILLA: 5, INMUEBLE: 1 } // 2=amarillo 5=azul 1=rojo

  let d = ''
  // HEADER
  d += '0\nSECTION\n2\nHEADER\n'
  d += '9\n$ACADVER\n1\nAC1015\n'
  d += '9\n$INSUNITS\n70\n6\n'   // 6 = metros
  d += '9\n$PDMODE\n70\n35\n'    // estilo de punto visible (cruz + círculo)
  d += '9\n$PDSIZE\n40\n3.0\n'   // tamaño del punto
  d += '0\nENDSEC\n'

  // TABLES → capas
  d += '0\nSECTION\n2\nTABLES\n'
  d += `0\nTABLE\n2\nLAYER\n70\n${layers.length + 1}\n`
  d += '0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n'
  layers.forEach(l => {
    d += `0\nLAYER\n2\n${l}\n70\n0\n62\n${COLORS[l]||3}\n6\nCONTINUOUS\n`
  })
  d += '0\nENDTAB\n0\nENDSEC\n'

  // ENTITIES
  d += '0\nSECTION\n2\nENTITIES\n'
  pts.forEach(p => {
    // Punto
    d += `0\nPOINT\n8\n${p.layer}\n10\n${p.x.toFixed(3)}\n20\n${p.y.toFixed(3)}\n30\n0.0\n`
    // Etiqueta de texto
    d += `0\nTEXT\n8\n${p.layer}\n10\n${(p.x+1.5).toFixed(3)}\n20\n${(p.y+1.5).toFixed(3)}\n30\n0.0\n40\n2.5\n1\n${p.label}\n`
  })
  d += '0\nENDSEC\n0\nEOF\n'

  const blob = new Blob([d], { type: 'application/dxf' })
  const url  = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), {
    href: url,
    download: `catastro_${new Date().toISOString().slice(0,10)}.dxf`,
  }).click()
  URL.revokeObjectURL(url)
  if (onSuccess) onSuccess()
}

/* ── Export GeoJSON ── */
function exportGeoJSON(records) {
  const features = []
  records.forEach(r => {
    if (!Array.isArray(r.infra_mapa)) return
    r.infra_mapa.forEach(m => {
      const utm = toUTM(m.lat, m.lng)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
        properties: {
          manzana:        r.manzana,
          tipo_vialidad:  TIPO_LABELS[r.tipo_vialidad] ?? r.tipo_vialidad,
          nombre_vialidad: r.nombre_vialidad,
          tipo:           m.type,
          subtipo:        m.subtype ?? null,
          utm_zona:       `${utm.zone}${utm.hemi}`,
          utm_este:       utm.easting,
          utm_norte:      utm.northing,
          latitud:        m.lat,
          longitud:       m.lng,
        },
      })
    })
  })
  const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: `catastro_infra_${new Date().toISOString().slice(0,10)}.geojson` }).click()
  URL.revokeObjectURL(url)
}

/* ── Cluster layer (markercluster imperative API) ── */
function ClusterLayer({ points, onDetail }) {
  const map = useMap()
  useEffect(() => {
    const group = L.markerClusterGroup({ maxClusterRadius: 40, showCoverageOnHover: false })
    points.forEach(m => {
      const marker = L.marker([m.lat, m.lng], { icon: makePinIcon(PIN_COLORS[m.type] ?? '#666') })
      marker.bindPopup(
        `<div style="font-size:12px;line-height:1.7;min-width:160px">` +
        `<b style="font-size:13px">Manzana ${m.manzana}</b><br/>` +
        `<span style="color:#737373">${m.vialidad}</span><br/>` +
        `<span style="text-transform:capitalize;font-weight:600">${m.type}${m.subtype ? ' · ' + m.subtype : ''}</span><br/>` +
        `<button data-rid="${m.rid}" style="margin-top:6px;padding:9px 10px;font-size:12px;font-weight:700;background:#0a0a0a;color:#fff;border:none;border-radius:6px;cursor:pointer;width:100%">Ver detalle</button>` +
        `</div>`
      )
      marker.on('popupopen', () => {
        setTimeout(() => {
          const btn = document.querySelector(`button[data-rid="${m.rid}"]`)
          if (btn) btn.onclick = () => onDetail && onDetail(m.rid)
        }, 0)
      })
      group.addLayer(marker)
    })
    map.addLayer(group)
    return () => { map.removeLayer(group) }
  }, [map, points, onDetail])
  return null
}

/* ── Fly to target ── */
function AdminFlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, 17, { duration: 1 })
  }, [target, map])
  return null
}

/* ── Export XLSX ── */
function exportXLSX(records) {
  const rows = records.map(r => ({
    'Fecha':                  new Date(r.created_at).toLocaleDateString('es-MX'),
    'Manzana':                r.manzana,
    'Tipo Vialidad':          TIPO_LABELS[r.tipo_vialidad] ?? r.tipo_vialidad,
    'Nombre Vialidad':        r.nombre_vialidad,
    ...Object.fromEntries(SERVICIOS_FULL.map(s => [`Serv_${s.label}`, r.servicios?.[s.key] ?? ''])),
    ...Object.fromEntries(EQUIPAMIENTO_FULL.map(e => [`Equip_${e.label}`, r.equipamiento?.[e.key] === '1' ? 'Sí' : r.equipamiento?.[e.key] === '0' ? 'No' : ''])),
    'Subtotal Servicios':     Number(r.subtotal_servicios).toFixed(4),
    'Subtotal Equipamiento':  r.subtotal_equipamiento,
    'Total':                  Number(r.total).toFixed(4),
    'Puntos Infraestructura': Array.isArray(r.infra_mapa) ? r.infra_mapa.length : 0,
    'Observaciones':          r.observaciones ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Catastro')
  XLSX.writeFile(wb, `catastro_${new Date().toISOString().slice(0,10)}.xlsx`)
}

/* ── Print report ── */
function PrintReport({ record, onClose }) {
  const ref = useRef(null)
  const infraMarkers = Array.isArray(record.infra_mapa) ? record.infra_mapa : []

  useEffect(() => {
    const t = setTimeout(() => {
      window.print()
    }, 300)
    const handler = () => onClose()
    window.addEventListener('afterprint', handler)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', handler) }
  }, [onClose])

  return (
    <div ref={ref} className="print-report">
      <div className="pr-header">
        <div className="pr-logo">CATASTRO IXMIQUILPAN</div>
        <div className="pr-title">Ficha de Registro — Manzana {record.manzana}</div>
        <div className="pr-sub">
          {TIPO_LABELS[record.tipo_vialidad] ?? record.tipo_vialidad} {record.nombre_vialidad} &nbsp;·&nbsp;
          {new Date(record.created_at).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' })}
        </div>
      </div>

      <div className="pr-scores">
        <div className="pr-score"><span>Subtotal Servicios</span><b>{Number(record.subtotal_servicios).toFixed(4)}</b></div>
        <div className="pr-score"><span>Subtotal Equipamiento</span><b>{record.subtotal_equipamiento}</b></div>
        <div className="pr-score pr-score-total"><span>TOTAL</span><b>{Number(record.total).toFixed(4)}</b></div>
      </div>

      <div className="pr-section-title">Servicios e Infraestructura</div>
      <table className="pr-table">
        <thead><tr><th>Servicio</th><th>Calidad</th></tr></thead>
        <tbody>
          {SERVICIOS_FULL.map(s => {
            const v = record.servicios?.[s.key]
            const o = OPCIONES.find(o => o.val === v)
            return <tr key={s.key}><td>{s.label}</td><td>{o?.label ?? '—'}</td></tr>
          })}
        </tbody>
      </table>

      <div className="pr-section-title" style={{ marginTop: '1rem' }}>Equipamiento Urbano</div>
      <table className="pr-table">
        <thead><tr><th>Equipamiento</th><th>Presencia</th></tr></thead>
        <tbody>
          {EQUIPAMIENTO_FULL.map(e => {
            const v = record.equipamiento?.[e.key]
            return <tr key={e.key}><td>{e.label}</td><td>{v === '1' ? 'Sí hay' : v === '0' ? 'No hay' : '—'}</td></tr>
          })}
        </tbody>
      </table>

      {infraMarkers.length > 0 && (
        <>
          <div className="pr-section-title" style={{ marginTop: '1rem' }}>
            Infraestructura registrada ({infraMarkers.length} puntos)
          </div>
          <table className="pr-table">
            <thead><tr><th>#</th><th>Tipo</th><th>Subtipo</th><th>UTM Zona</th><th>Este (m)</th><th>Norte (m)</th><th>Latitud</th><th>Longitud</th></tr></thead>
            <tbody>
              {infraMarkers.map((m, i) => {
                const utm = toUTM(m.lat, m.lng)
                return (
                  <tr key={`${m.lat}-${m.lng}-${m.type}`}>
                    <td>{i+1}</td>
                    <td style={{ textTransform:'capitalize' }}>{m.type}</td>
                    <td>{m.subtype ?? '—'}</td>
                    <td>{utm.zone}{utm.hemi}</td>
                    <td>{utm.easting.toLocaleString()}</td>
                    <td>{utm.northing.toLocaleString()}</td>
                    <td>{m.lat.toFixed(6)}</td>
                    <td>{m.lng.toFixed(6)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      {record.observaciones && (
        <>
          <div className="pr-section-title" style={{ marginTop: '1rem' }}>Observaciones</div>
          <p className="pr-obs">{record.observaciones}</p>
        </>
      )}

      <div className="pr-footer">
        Generado el {new Date().toLocaleString('es-MX')} &nbsp;·&nbsp; Sistema de Catastro Ixmiquilpan
      </div>

      <button className="pr-close-btn no-print" onClick={onClose}><Icon name="close" size={14}/> Cerrar vista de impresión</button>
    </div>
  )
}

/* ── Edit Modal ── */
function EditModal({ record, onSave, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const [form, setForm] = useState({
    manzana:        record.manzana,
    tipo_vialidad:  record.tipo_vialidad,
    nombre_vialidad: record.nombre_vialidad,
    tipo_pavimento: record.tipo_pavimento ?? '',
    observaciones:  record.observaciones ?? '',
    servicios:      { ...record.servicios },
    equipamiento:   { ...record.equipamiento },
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    setSaving(true)
    await onSave(record.id, form)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-modal" onClick={e => e.stopPropagation()}>
        <div className="detail-header">
          <div><h2>Editar Manzana {record.manzana}</h2></div>
          <button className="detail-close" onClick={onClose} aria-label="Cerrar"><Icon name="close" size={14}/></button>
        </div>
        <div className="edit-body">

          {/* Identificación */}
          <h3 className="detail-sect">Identificación</h3>
          <div className="edit-row">
            <div className="edit-field">
              <label>Manzana</label>
              <input value={form.manzana} onChange={e => set('manzana', e.target.value)} />
            </div>
            <div className="edit-field">
              <label>Nombre de Vialidad</label>
              <input value={form.nombre_vialidad} onChange={e => set('nombre_vialidad', e.target.value)} />
            </div>
          </div>
          <div className="edit-field" style={{ marginTop: '.75rem' }}>
            <label>Tipo de Vialidad</label>
            <div className="edit-vial-grid">
              {TIPOS_VIALIDAD.map(t => (
                <button
                  key={t.code}
                  type="button"
                  className={`edit-vial-btn ${form.tipo_vialidad === t.code ? 'evb-active' : ''}`}
                  onClick={() => set('tipo_vialidad', t.code)}
                >
                  <b>{t.code}</b> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de pavimento — solo si pavimento está capturado */}
          {form.servicios?.pavimento && form.servicios.pavimento !== 'N' && (
            <div className="edit-field" style={{ marginTop: '.75rem' }}>
              <label>Tipo de Pavimento</label>
              <div className="edit-vial-grid">
                {TIPOS_PAVIMENTO.map(t => (
                  <button
                    key={t.code}
                    type="button"
                    className={`edit-vial-btn ${form.tipo_pavimento === t.code ? 'evb-active' : ''}`}
                    onClick={() => set('tipo_pavimento', t.code)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Servicios */}
          <h3 className="detail-sect" style={{ marginTop: '1rem' }}>Servicios</h3>
          <div className="edit-servicios">
            {SERVICIOS_FULL.map(s => (
              <div key={s.key} className="edit-serv-row">
                <span className="edit-serv-label">{s.label}</span>
                <div className="edit-serv-opts">
                  {OPCIONES.map(o => (
                    <button
                      key={o.val}
                      type="button"
                      className={`edit-serv-btn ${form.servicios[s.key] === o.val ? 'esb-active' : ''}`}
                      style={form.servicios[s.key] === o.val ? { background: o.color, color: '#fff', borderColor: o.color } : {}}
                      onClick={() => setForm(p => ({
                        ...p,
                        servicios: { ...p.servicios, [s.key]: o.val },
                        ...(s.key === 'pavimento' && o.val === 'N' ? { tipo_pavimento: '' } : {}),
                      }))}
                    >
                      {o.label[0]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Equipamiento */}
          <h3 className="detail-sect" style={{ marginTop: '1rem' }}>Equipamiento</h3>
          <div className="edit-servicios">
            {EQUIPAMIENTO_FULL.map(e => (
              <div key={e.key} className="edit-serv-row">
                <span className="edit-serv-label">{e.label}</span>
                <div className="edit-serv-opts">
                  {[{val:'1',label:'Sí',color:'#15803d'},{val:'0',label:'No',color:'#a3a3a3'}].map(o => (
                    <button
                      key={o.val}
                      type="button"
                      className={`edit-serv-btn ${form.equipamiento[e.key] === o.val ? 'esb-active' : ''}`}
                      style={form.equipamiento[e.key] === o.val ? { background: o.color, color: '#fff', borderColor: o.color } : {}}
                      onClick={() => setForm(p => ({ ...p, equipamiento: { ...p.equipamiento, [e.key]: o.val } }))}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Observaciones */}
          <h3 className="detail-sect" style={{ marginTop: '1rem' }}>Observaciones</h3>
          <textarea
            className="edit-obs"
            value={form.observaciones}
            onChange={e => set('observaciones', e.target.value)}
            rows={3}
            placeholder="Notas adicionales…"
          />

          <div className="edit-footer">
            <button className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button className="btn-save" disabled={saving} onClick={handleSave}>
              {saving ? <><span className="btn-spinner btn-spinner-dark"/> Guardando…</> : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Detail Modal ── */
function DetailModal({ record, onClose, onEdit, onPrint }) {
  if (!record) return null
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  const infraMarkers = Array.isArray(record.infra_mapa) ? record.infra_mapa : []
  const mapCenter = infraMarkers.length > 0
    ? [infraMarkers.reduce((s,m)=>s+m.lat,0)/infraMarkers.length, infraMarkers.reduce((s,m)=>s+m.lng,0)/infraMarkers.length]
    : [20.4878, -99.1533]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e => e.stopPropagation()}>
        <div className="detail-header">
          <div>
            <h2>Manzana {record.manzana}</h2>
            <span className="detail-sub">
              {TIPO_LABELS[record.tipo_vialidad] ?? record.tipo_vialidad} {record.nombre_vialidad} ·{' '}
              {new Date(record.created_at).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' })}
            </span>
          </div>
          <div className="detail-header-btns">
            <button className="btn-edit-detail" onClick={() => onEdit(record)} title="Editar"><Icon name="edit" size={13}/> Editar</button>
            <button className="btn-print-detail" onClick={() => onPrint(record)} title="Imprimir PDF"><Icon name="printer" size={13}/> PDF</button>
            <button className="detail-close" onClick={onClose} aria-label="Cerrar"><Icon name="close" size={14}/></button>
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-scores">
            <div className="detail-score-item"><span>Servicios</span><b>{Number(record.subtotal_servicios).toFixed(2)}</b></div>
            <div className="detail-score-item"><span>Equipamiento</span><b>{record.subtotal_equipamiento}</b></div>
            <div className="detail-score-item total"><span>Total</span><b>{Number(record.total).toFixed(2)}</b></div>
          </div>

          <h3 className="detail-sect">Servicios</h3>
          <div className="detail-grid">
            {SERVICIOS_FULL.map(s => {
              const v = record.servicios?.[s.key]
              const o = OPCIONES.find(o => o.val === v)
              return (
                <div key={s.key} className="detail-item">
                  <span>{s.label}</span>
                  <span className="detail-badge" style={{ background: o?.color ?? '#e5e5e5' }}>{o?.label ?? '—'}</span>
                </div>
              )
            })}
          </div>

          <h3 className="detail-sect">Equipamiento</h3>
          <div className="detail-grid">
            {EQUIPAMIENTO_FULL.map(e => {
              const v = record.equipamiento?.[e.key]
              return (
                <div key={e.key} className="detail-item">
                  <span>{e.label}</span>
                  <span className="detail-badge" style={{ background: v==='1' ? '#15803d' : '#a3a3a3' }}>
                    {v==='1' ? 'Sí' : v==='0' ? 'No' : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {infraMarkers.length > 0 && (
            <>
              <h3 className="detail-sect">Infraestructura ({infraMarkers.length} punto{infraMarkers.length!==1?'s':''})</h3>
              <div className="detail-map-wrap">
                <MapContainer center={mapCenter} zoom={17} style={{ height:'320px', width:'100%' }} scrollWheelZoom={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                  {infraMarkers.map((m,i) => (
                    <Marker key={i} position={[m.lat,m.lng]} icon={makePinIcon(PIN_COLORS[m.type]??'#666')}>
                      <Popup>
                        <div style={{ fontSize:'12px', lineHeight:1.6 }}>
                          <b style={{ textTransform:'capitalize' }}>{m.type}{m.subtype ? ` · ${m.subtype}` : ''}</b><br/>
                          <span style={{ color:'#6366f1', fontFamily:'monospace' }}>UTM {toUTM(m.lat,m.lng).label}</span><br/>
                          <span style={{ color:'#888', fontFamily:'monospace', fontSize:'11px' }}>{m.lat.toFixed(6)}, {m.lng.toFixed(6)}</span>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              <div className="detail-infra-list">
                {infraMarkers.map((m,i) => {
                  const utm = toUTM(m.lat,m.lng)
                  return (
                    <div key={i} className="detail-infra-item">
                      <span className="detail-infra-type" style={{ textTransform:'capitalize' }}>{m.type}{m.subtype ? ` · ${m.subtype}` : ''}</span>
                      <span className="detail-infra-utm">UTM {utm.label}</span>
                      <span className="detail-infra-geo">{m.lat.toFixed(6)}, {m.lng.toFixed(6)}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {infraMarkers.length === 0 && (
            <div style={{ textAlign:'center', color:'#a3a3a3', padding:'1rem', fontSize:'.82rem' }}>
              Sin puntos de infraestructura en este registro.
            </div>
          )}

          {record.observaciones && (
            <>
              <h3 className="detail-sect">Observaciones</h3>
              <p className="detail-obs">{record.observaciones}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════ */
export default function AdminDashboard({ session, onLogout, onBack }) {
  const [tab, setTab]         = useState('stats')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [detail, setDetail]   = useState(null)
  const [editing, setEditing] = useState(null)
  const [printing, setPrinting] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [mapFilter, setMapFilter]   = useState('all')
  const [mapView, setMapView]       = useState('infra')   // 'infra' | 'score'
  const [mapSearch, setMapSearch]   = useState('')
  const [scoreFocus, setScoreFocus] = useState(null)   // manzana seleccionada en ranking
  const [showManzanasSheet, setShowManzanasSheet] = useState(false)
  const [manzanaSheetSearch, setManzanaSheetSearch] = useState('')
  const [mapFlyTarget, setMapFlyTarget] = useState(null)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const [toast, setToast]           = useState('')
  const toastRef                    = useRef(null)
  const [mapTileLayer, setMapTileLayer] = useState('osm')
  const [realtimeOk, setRealtimeOk]   = useState(true)

  const [statsFrom, setStatsFrom]   = useState('')
  const [statsTo, setStatsTo]       = useState('')
  const [recView, setRecView]       = useState('table')

  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef(null)
  const [pageSize, setPageSize]     = useState(PAGE_SIZE_DEFAULT)
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    const on  = () => { setIsOnline(true); loadData() }
    const off = () => setIsOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Escape cierra el modal de confirmación de borrado
  useEffect(() => {
    if (!deleting) return
    const h = (e) => { if (e.key === 'Escape') setDeleting(null) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [deleting])

  // Click fuera cierra el dropdown de exportar
  useEffect(() => {
    if (!exportOpen) return
    const h = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [exportOpen])

  const showToast = (msg) => {
    clearTimeout(toastRef.current)
    setToast(msg)
    toastRef.current = setTimeout(() => setToast(''), 2400)
  }

  // Records search / filter / sort / pagination
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch]       = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw), 300)
    return () => clearTimeout(t)
  }, [searchRaw])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [page, setPage]         = useState(1)
  const [sortCol, setSortCol]   = useState('fecha')
  const [sortDir, setSortDir]   = useState('desc')

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!isConfigured || !supabase) return
    let channel
    let reconnectTimer
    const subscribe = () => {
      channel = supabase.channel('registros-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registros' },
          payload => setRecords(prev =>
            prev.some(r => r.id === payload.new.id) ? prev : [payload.new, ...prev]
          ))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'registros' },
          payload => setRecords(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r)))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'registros' },
          payload => setRecords(prev => prev.filter(r => r.id !== payload.old.id)))
        .subscribe(status => {
          if (status === 'SUBSCRIBED') setRealtimeOk(true)
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setRealtimeOk(false)
            reconnectTimer = setTimeout(() => {
              supabase.removeChannel(channel)
              subscribe()
            }, 5000)
          }
        })
    }
    subscribe()
    // En móvil el WebSocket se cae cuando el navegador va al fondo.
    // Al volver a pantalla se recargan los datos para no mostrar info obsoleta.
    const onVisible = () => { if (document.visibilityState === 'visible') loadData() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(reconnectTimer)
      channel.unsubscribe()
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    document.title = 'Catastro — Admin'
    return () => { document.title = 'Catastro — Captura de Servicios' }
  }, [])

  // Reset page and selection when search/date/sort/pageSize changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
    setSelectedIds(new Set())
  }, [search, dateFrom, dateTo, sortCol, sortDir, pageSize])

  async function loadData() {
    setLoading(true); setError('')
    if (!isConfigured) {
      setRecords([
        { id:1, manzana:'42', tipo_vialidad:'CAL', nombre_vialidad:'Principal', subtotal_servicios:4.68, subtotal_equipamiento:6, total:10.68, created_at: new Date().toISOString(),
          servicios:{ aguaPotable:'B', drenaje:'B', alcantarillado:'R', electrificacion:'B', guarniciones:'B', banquetas:'B', pavimento:'B', recoleccionBasura:'N' },
          equipamiento:{ educacionCultura:'1', transportePublico:'1', comercioAbasto:'1', recreacionDeporte:'0', saludAsistencia:'1', telefono:'1', correosYTelegrafo:'0', contaminacion:'0', calleEspecial:'0' }, infra_mapa:[] },
        { id:2, manzana:'15', tipo_vialidad:'AVE', nombre_vialidad:'Independencia', subtotal_servicios:3.80, subtotal_equipamiento:4, total:7.80, created_at: new Date(Date.now()-86400000).toISOString(),
          servicios:{ aguaPotable:'B', drenaje:'R', alcantarillado:'R', electrificacion:'B', guarniciones:'B', banquetas:'M', pavimento:'R', recoleccionBasura:'B' },
          equipamiento:{ educacionCultura:'1', transportePublico:'0', comercioAbasto:'1', recreacionDeporte:'1', saludAsistencia:'0', telefono:'1', correosYTelegrafo:'1', contaminacion:'0', calleEspecial:'0' }, infra_mapa:[] },
      ])
      setLoading(false); return
    }
    const { data: recs, error: rErr } = await supabase
      .from('registros').select('*').order('created_at', { ascending: false })
    if (rErr) {
      if (rErr.status === 401 || rErr.code === 'PGRST301') { onLogout(); return }
      setError(`Error: ${rErr.message}`); setLoading(false); return
    }
    setRecords(recs ?? [])
    setLoading(false)
  }

  /* ── Update ── */
  async function handleUpdate(id, form) {
    const OPCIONES_SERVICIO = [
      { val:'B', peso:0.76 }, { val:'R', peso:0.70 }, { val:'M', peso:0.64 }, { val:'N', peso:1.00 },
    ]
    const subtotal_servicios = SERVICIOS_FULL.reduce((s, item) => {
      const v = form.servicios[item.key]
      return v ? s + (OPCIONES_SERVICIO.find(o=>o.val===v)?.peso ?? 0) : s
    }, 0)
    const subtotal_equipamiento = EQUIPAMIENTO_FULL.reduce((s, item) => {
      return s + Number(form.equipamiento[item.key] ?? 0)
    }, 0)
    const total = subtotal_servicios + subtotal_equipamiento
    const payload = {
      manzana: form.manzana,
      tipo_vialidad: form.tipo_vialidad,
      nombre_vialidad: form.nombre_vialidad,
      tipo_pavimento: form.tipo_pavimento || null,
      observaciones: form.observaciones.trim() || null,
      servicios: form.servicios,
      equipamiento: form.equipamiento,
      subtotal_servicios,
      subtotal_equipamiento,
      total,
    }
    if (isConfigured) {
      const { error } = await supabase.from('registros').update(payload).eq('id', id)
      if (error) {
        if (error.status === 401 || error.code === 'PGRST301') { onLogout(); return }
        showToast('Error al guardar: ' + error.message); return
      }
    }
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...payload } : r))
    setEditing(null)
    setDetail(null)
    showToast('Cambios guardados')
  }

  /* ── Delete ── */
  async function handleDelete(id) {
    const snapshot = records
    setRecords(r => r.filter(x => x.id !== id))
    setDeleting(null)
    setDeleteInProgress(true)
    if (isConfigured) {
      const { error } = await supabase.from('registros').delete().eq('id', id)
      if (error) {
        if (error.status === 401 || error.code === 'PGRST301') { onLogout(); return }
        setRecords(snapshot)
        showToast('Error al eliminar: ' + error.message)
        setDeleteInProgress(false)
        return
      }
    }
    setDeleteInProgress(false)
    showToast('Registro eliminado')
  }

  /* ── Filtered + paged records ── */
  const filteredRecords = useMemo(() => {
    let res = records
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      res = res.filter(r =>
        String(r.manzana).toLowerCase().includes(q) ||
        r.nombre_vialidad?.toLowerCase().includes(q) ||
        (TIPO_LABELS[r.tipo_vialidad] ?? r.tipo_vialidad)?.toLowerCase().includes(q)
      )
    }
    if (dateFrom) res = res.filter(r => new Date(r.created_at) >= new Date(dateFrom + 'T00:00:00'))
    if (dateTo)   res = res.filter(r => new Date(r.created_at) <= new Date(dateTo + 'T23:59:59'))
    res = [...res].sort((a, b) => {
      let va, vb
      if (sortCol === 'fecha')      { va = a.created_at; vb = b.created_at }
      else if (sortCol === 'manzana')    { va = Number(a.manzana); vb = Number(b.manzana) }
      else if (sortCol === 'servicios')  { va = Number(a.subtotal_servicios); vb = Number(b.subtotal_servicios) }
      else if (sortCol === 'equip')      { va = Number(a.subtotal_equipamiento); vb = Number(b.subtotal_equipamiento) }
      else if (sortCol === 'total')      { va = Number(a.total); vb = Number(b.total) }
      else return 0
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return res
  }, [records, search, dateFrom, dateTo, sortCol, sortDir])

  const chartRecords = useMemo(() => {
    let r = records
    if (statsFrom) r = r.filter(x => new Date(x.created_at) >= new Date(statsFrom + 'T00:00:00'))
    if (statsTo)   r = r.filter(x => new Date(x.created_at) <= new Date(statsTo + 'T23:59:59'))
    return r
  }, [records, statsFrom, statsTo])

  const manzanasSinInfra = useMemo(() =>
    records.filter(r => !Array.isArray(r.infra_mapa) || r.infra_mapa.length === 0)
  , [records])

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }
  const sortIcon = (col) => sortCol !== col ? null
    : <Icon name={sortDir === 'asc' ? 'arrowUp' : 'arrowDown'} size={11} style={{marginLeft:3,verticalAlign:'middle',opacity:.65}}/>

  const totalPages  = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const pagedRecords = filteredRecords.slice((page-1)*pageSize, page*pageSize)

  const allPageSelected = pagedRecords.length > 0 && pagedRecords.every(r => selectedIds.has(r.id))
  const somePageSelected = !allPageSelected && pagedRecords.some(r => selectedIds.has(r.id))
  const toggleSelectAll = () => setSelectedIds(prev => {
    const next = new Set(prev)
    if (allPageSelected) pagedRecords.forEach(r => next.delete(r.id))
    else pagedRecords.forEach(r => next.add(r.id))
    return next
  })
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  /* ── Stats ── */
  const stats = useMemo(() => {
    const n = chartRecords.length; if (!n) return null
    const avgS = chartRecords.reduce((s,r)=>s+(r.subtotal_servicios??0),0)/n
    const avgE = chartRecords.reduce((s,r)=>s+(r.subtotal_equipamiento??0),0)/n
    const avgT = chartRecords.reduce((s,r)=>s+(r.total??0),0)/n
    return { n, avgS: avgS.toFixed(2), avgE: avgE.toFixed(1), avgT: avgT.toFixed(2) }
  }, [chartRecords])

  const servChartData = useMemo(() =>
    SERVICIOS_LIST.map(({ key, label }) => {
      const cnt = { B:0, R:0, M:0, N:0 }
      chartRecords.forEach(r => { const v = r.servicios?.[key]; if (v in cnt) cnt[v]++ })
      return { label, ...cnt }
    }), [chartRecords])

  const equipChartData = useMemo(() =>
    EQUIPAMIENTO_LIST.map(({ key, label }) => {
      let si=0, no=0
      chartRecords.forEach(r => { const v=r.equipamiento?.[key]; if(v==='1')si++; else if(v==='0')no++ })
      return { label, Sí: si, No: no }
    }), [chartRecords])

  const timeChartData = useMemo(() => {
    const map = {}
    chartRecords.forEach(r => {
      const d = new Date(r.created_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short' })
      map[d] = (map[d]??0)+1
    })
    return Object.entries(map).reverse().map(([fecha,count])=>({ fecha, count }))
  }, [chartRecords])

  // Radar: calidad promedio por servicio (B=1, R=0.7, M=0.3, N=0)
  const radarData = useMemo(() => {
    const PESO = { B:1, R:0.7, M:0.3, N:0 }
    return SERVICIOS_LIST.map(({ key, label }) => {
      const vals = chartRecords.map(r => PESO[r.servicios?.[key]] ?? null).filter(v => v !== null)
      const avg = vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : 0
      return { label, calidad: Math.round(avg * 100) }
    })
  }, [chartRecords])

  // Pie: distribución por tipo de vialidad
  const vialidadPieData = useMemo(() => {
    const map = {}
    chartRecords.forEach(r => {
      const k = TIPO_LABELS[r.tipo_vialidad] ?? r.tipo_vialidad ?? 'Sin tipo'
      map[k] = (map[k] ?? 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value)
  }, [chartRecords])

  // Top 10 manzanas con mayor puntaje
  const topManzanas = useMemo(() =>
    [...chartRecords]
      .sort((a,b) => Number(b.total) - Number(a.total))
      .slice(0, 10)
      .map(r => ({
        manzana: `Mz ${r.manzana}`,
        total: Number(r.total).toFixed(2),
        fill: Number(r.total) >= 12 ? '#15803d' : Number(r.total) >= 8 ? '#6366f1' : '#b45309',
      }))
  , [chartRecords])

  /* ══ RENDER ══ */
  return (
    <div className="ad-page">

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:'1.5rem', left:'50%', transform:'translateX(-50%)',
          background:'#0a0a0a', color:'#fff', fontSize:'.82rem', fontWeight:600,
          padding:'10px 20px', borderRadius:'99px', boxShadow:'0 8px 24px rgba(0,0,0,.25)',
          zIndex:2000, whiteSpace:'nowrap', pointerEvents:'none',
          animation:'toastIn .2s ease',
        }}>{toast}</div>
      )}

      {/* Print report — shown only on print */}
      {printing && <PrintReport record={printing} onClose={() => setPrinting(null)} />}

      {/* Manzanas sheet */}
      {showManzanasSheet && (() => {
        const sheetQ = manzanaSheetSearch.trim().toLowerCase()
        const sheetRecords = [...records]
          .sort((a, b) => Number(a.manzana) - Number(b.manzana))
          .filter(r => !sheetQ ||
            String(r.manzana).includes(sheetQ) ||
            r.nombre_vialidad?.toLowerCase().includes(sheetQ)
          )
        return (
          <div className="modal-overlay" onClick={() => { setShowManzanasSheet(false); setManzanaSheetSearch('') }}>
            <div className="manzanas-sheet" onClick={e => e.stopPropagation()}>
              <div className="manzanas-sheet-head">
                <span>Manzanas capturadas ({records.length})</span>
                <button className="detail-close" onClick={() => { setShowManzanasSheet(false); setManzanaSheetSearch('') }}><Icon name="close" size={14}/></button>
              </div>
              <div className="mz-ps-search-wrap">
                <input
                  className="mz-ps-search"
                  type="search"
                  placeholder="Buscar manzana o vialidad…"
                  value={manzanaSheetSearch}
                  onChange={e => setManzanaSheetSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="manzanas-sheet-grid">
                {sheetRecords.length === 0 && (
                  <span className="mz-no-results">Sin resultados</span>
                )}
                {sheetRecords.map(r => {
                  const hasPts = Array.isArray(r.infra_mapa) && r.infra_mapa.length > 0
                  return (
                    <div
                      key={r.id}
                      className={`manzana-chip${hasPts ? '' : ' manzana-chip-nomap'}`}
                      onClick={() => { setShowManzanasSheet(false); setManzanaSheetSearch(''); setDetail(r); if (hasPts) { flyToManzana(r); setTab('mapa') } }}
                      title={hasPts ? `Manzana ${r.manzana} — ${r.infra_mapa.length} pt` : `Manzana ${r.manzana} — sin puntos`}
                    >
                      <span className="manzana-chip-num">{r.manzana}</span>
                      <span className="manzana-chip-via">{r.tipo_vialidad} {r.nombre_vialidad}</span>
                      <span className="manzana-chip-score">{Number(r.total).toFixed(1)}</span>
                      {hasPts && <span className="manzana-chip-pts">{r.infra_mapa.length}pt</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {detail && !editing && (
        <DetailModal
          record={detail}
          onClose={() => setDetail(null)}
          onEdit={r => { setEditing(r); setDetail(null) }}
          onPrint={r => setPrinting(r)}
        />
      )}

      {editing && (
        <EditModal
          record={editing}
          onSave={handleUpdate}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <div className="modal-overlay" onClick={() => setDeleting(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>¿Eliminar registro?</h3>
            <p>Manzana <b>{deleting.manzana}</b> — {TIPO_LABELS[deleting.tipo_vialidad] ?? deleting.tipo_vialidad} {deleting.nombre_vialidad}</p>
            <p className="confirm-warn">Esta acción no se puede deshacer.</p>
            <div className="confirm-btns">
              <button className="btn-cancel" disabled={deleteInProgress} onClick={() => setDeleting(null)}>Cancelar</button>
              <button className="btn-delete-confirm" disabled={deleteInProgress} onClick={() => handleDelete(deleting.id)}>
                {deleteInProgress ? <><span className="btn-spinner"/> Eliminando…</> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className="ad-topbar">
        <div className="ad-topbar-inner">
          <span className="ad-brand">Catastro <span className="ad-tag">Admin</span></span>
          <div className="ad-topbar-right">
            <span className="ad-email">{session?.user?.email}</span>
            {onBack && (
              <button className="ad-back-btn" onClick={onBack} title="Volver al formulario">
                <Icon name="back" size={13}/> Formulario
              </button>
            )}
            <button className="ad-logout-btn" onClick={onLogout}><Icon name="logout" size={13}/> Salir</button>
          </div>
        </div>
      </div>

      <div className="ad-body">
        {!isConfigured && <div className="ad-demo-banner"><Icon name="warning" size={15}/> Modo desarrollo — datos de demostración.</div>}
        {!isOnline && <div className="ad-offline-banner"><Icon name="offline" size={15}/> Sin internet — los cambios no se guardarán hasta reconectarte.</div>}
        {isConfigured && isOnline && !realtimeOk && (
          <div className="ad-realtime-banner"><Icon name="lightning" size={15}/> Sin conexión en tiempo real — los cambios no se reflejarán automáticamente. <button onClick={loadData}>Recargar</button></div>
        )}

        <nav className="ad-tabs">
          {[
            { key:'stats',   label:'Estadísticas', icon:'barChart' },
            { key:'mapa',    label:'Mapa',          icon:'map' },
            { key:'records', label:`Registros${stats ? ` (${stats.n})` : ''}`, icon:'list' },
          ].map(t => (
            <button key={t.key} className={`ad-tab ${tab===t.key ? 'ad-tab-on' : ''}`} onClick={() => setTab(t.key)}>
              <Icon name={t.icon} size={14}/> {t.label}
            </button>
          ))}
          <button className="ad-refresh" onClick={loadData} title="Actualizar" aria-label="Actualizar datos">
            <Icon name="refresh" size={15}/>
          </button>
        </nav>

        {loading && (
          <div className="ad-skeletons">
            <div className="ad-skel-cards">
              {[0,1,2,3].map(i => (
                <div key={i} className="ad-skel-card">
                  <div className="ad-skel-line ad-skel-val"/>
                  <div className="ad-skel-line ad-skel-lbl"/>
                </div>
              ))}
            </div>
            <div className="ad-skel-table">
              {[0,1,2,3,4,5].map(i => <div key={i} className="ad-skel-row"/>)}
            </div>
          </div>
        )}
        {error && (
          <div className="ad-error">
            <span>{error}</span>
            <button className="ad-error-retry" onClick={loadData}><Icon name="refresh" size={14}/> Reintentar</button>
          </div>
        )}

        {/* ══ MAPA ══ */}
        {tab==='mapa' && !loading && (() => {
          const allPoints = []
          records.forEach(r => {
            if (!Array.isArray(r.infra_mapa)) return
            r.infra_mapa.forEach(m => allPoints.push({
              ...m, manzana: r.manzana, rid: r.id,
              vialidad: `${TIPO_LABELS[r.tipo_vialidad]??r.tipo_vialidad} ${r.nombre_vialidad}`,
            }))
          })
          const filtered = mapFilter==='all' ? allPoints : allPoints.filter(m=>m.type===mapFilter)
          const mapCenter = filtered.length>0
            ? [filtered.reduce((s,m)=>s+m.lat,0)/filtered.length, filtered.reduce((s,m)=>s+m.lng,0)/filtered.length]
            : [20.4878, -99.1533]
          const counts = {
            luminaria:    allPoints.filter(m=>m.type==='luminaria').length,
            alcantarilla: allPoints.filter(m=>m.type==='alcantarilla').length,
            inmueble:     allPoints.filter(m=>m.type==='inmueble').length,
            agua:         allPoints.filter(m=>m.type==='agua').length,
          }

          // Score map: centroid per manzana (only those with infra points)
          const scoreManzanas = records
            .map(r => {
              const pts = Array.isArray(r.infra_mapa) ? r.infra_mapa : []
              if (!pts.length) return null
              const lat = pts.reduce((s,m)=>s+m.lat,0)/pts.length
              const lng = pts.reduce((s,m)=>s+m.lng,0)/pts.length
              return { id: r.id, manzana: r.manzana, total: Number(r.total), lat, lng,
                vialidad: `${TIPO_LABELS[r.tipo_vialidad]??r.tipo_vialidad} ${r.nombre_vialidad}` }
            })
            .filter(Boolean)

          // Map search suggestions
          const searchQ = mapSearch.trim().toLowerCase()
          const searchMatches = searchQ
            ? records.filter(r =>
                String(r.manzana).toLowerCase().includes(searchQ) ||
                r.nombre_vialidad?.toLowerCase().includes(searchQ)
              ).slice(0, 6)
            : []

          const flyToManzana = (r) => {
            const pts = Array.isArray(r.infra_mapa) ? r.infra_mapa : []
            if (pts.length) {
              const lat = pts.reduce((s,m)=>s+m.lat,0)/pts.length
              const lng = pts.reduce((s,m)=>s+m.lng,0)/pts.length
              setMapFlyTarget([lat, lng])
            }
            setMapSearch('')
          }

          return (
            <div>
              <div className="avance-panel">
                <div className="avance-header">
                  <h2>Avance de captura <InfoTooltip text={"Manzanas con registro completo\ncapturadas hasta el momento.\n\nMeta: 1,000 manzanas del\nmunicipio de Ixmiquilpan, Hgo."} /></h2>
                  <span className="avance-pct">{records.length} manzana{records.length!==1?'s':''} capturada{records.length!==1?'s':''}</span>
                </div>
                <div className="avance-bar-wrap">
                  <div className="avance-bar-track">
                    <div className="avance-bar-fill" style={{ width:`${Math.min((records.length/1000)*100,100).toFixed(1)}%` }}/>
                  </div>
                  <span className="avance-bar-label">{((records.length/1000)*100).toFixed(1)}% de 1,000</span>
                </div>
                <div className="avance-stats">
                  {[['#f59e0b','Luminarias',counts.luminaria],['#2563eb','Alcantarillas',counts.alcantarilla],['#dc2626','Inmuebles',counts.inmueble],['#0ea5e9','Agua',counts.agua],['#6366f1','Total puntos',allPoints.length]].map(([c,l,v])=>(
                    <div key={l} className="avance-stat"><Icon name="dot" size={9} style={{color:c,flexShrink:0}}/> {l} <b>{v}</b></div>
                  ))}
                </div>
              </div>

              {records.length > 0 && (
                <button className="avance-sheet-btn" onClick={() => setShowManzanasSheet(true)}>
                  Ver {records.length} manzana{records.length !== 1 ? 's' : ''} capturada{records.length !== 1 ? 's' : ''} <Icon name="arrowRight" size={14} style={{verticalAlign:'middle'}}/>
                </button>
              )}

              {/* Map controls: search + view toggle + type filters */}
              <div className="mapa-admin-controls">
                <div className="map-search-wrap">
                  <input
                    className="map-search-input"
                    placeholder="Buscar manzana…"
                    value={mapSearch}
                    onChange={e => setMapSearch(e.target.value)}
                  />
                  {searchMatches.length > 0 && (
                    <div className="map-search-dropdown">
                      {searchMatches.map(r => (
                        <button key={r.id} className="map-search-item" onClick={() => flyToManzana(r)}>
                          <b>Mz {r.manzana}</b> — {TIPO_LABELS[r.tipo_vialidad]??r.tipo_vialidad} {r.nombre_vialidad}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="map-view-toggle-wrap">
                  <div className="map-view-toggle">
                    <button className={`map-vt-btn ${mapView==='infra'?'map-vt-active':''}`} onClick={()=>{ setMapView('infra'); setScoreFocus(null) }}>Infraestructura</button>
                    <button className={`map-vt-btn ${mapView==='score'?'map-vt-active':''}`} onClick={()=>{ setMapView('score'); setScoreFocus(null) }}>Puntaje</button>
                  </div>
                  <InfoTooltip text={"Infraestructura — puntos físicos\nregistrados: luminarias, alcantarillas,\ninmuebles y agua.\n\nPuntaje — nivel de cada manzana\npor colores (Alto / Medio / Bajo)."} />
                </div>
              </div>

              {mapView === 'infra' && (
                <div className="mapa-admin-filters">
                  {[
                    { key:'all',label:`Todos (${allPoints.length})`,color:'#0a0a0a' },
                    { key:'luminaria',label:`Luminarias (${counts.luminaria})`,color:'#f59e0b' },
                    { key:'alcantarilla',label:`Alcantarillas (${counts.alcantarilla})`,color:'#2563eb' },
                    { key:'inmueble',label:`Inmuebles (${counts.inmueble})`,color:'#dc2626' },
                    { key:'agua',label:`Agua (${counts.agua})`,color:'#0ea5e9' },
                  ].map(f=>(
                    <button key={f.key} className={`mapa-admin-filter-btn ${mapFilter===f.key?'maf-active':''}`}
                      style={mapFilter===f.key?{borderColor:f.color,color:f.color}:{}} onClick={()=>setMapFilter(f.key)}>
                      <Icon name="dot" size={9} style={{color:f.color}}/> {f.label}
                    </button>
                  ))}
                  {allPoints.length > 0 && (
                    <div className="mapa-admin-filters-exports">
                      <span className="export-tip-wrap">
                        <button className="mapa-admin-filter-btn" onClick={() => exportGeoJSON(records)}><Icon name="download" size={13}/> GeoJSON</button>
                        <InfoTooltip text={"Formato GeoJSON para SIG:\nQGIS · ArcGIS · Google Maps\n\nIncluye coordenadas geográficas\ny atributos de cada punto."} />
                      </span>
                      <span className="export-tip-wrap">
                        <button className="mapa-admin-filter-btn btn-dxf" onClick={() => exportDXF(records, showToast, () => showToast('DXF descargado'))}><Icon name="download" size={13}/> DXF AutoCAD</button>
                        <InfoTooltip text={"Formato DXF para AutoCAD.\nCada tipo de infraestructura\nqueda en una capa separada\ncon coordenadas UTM en metros."} />
                      </span>
                    </div>
                  )}
                </div>
              )}

              {mapView === 'score' && (
                <div className="map-score-legend">
                  <span><span className="msl-dot" style={{background:'#15803d'}}/>Alto (≥12)</span>
                  <span><span className="msl-dot" style={{background:'#6366f1'}}/>Medio (≥8)</span>
                  <span><span className="msl-dot" style={{background:'#b45309'}}/>Bajo (&lt;8)</span>
                  {scoreManzanas.length === 0 && <span className="msl-note">Sin manzanas con infraestructura mapeada</span>}
                </div>
              )}

              {(allPoints.length === 0 && mapView === 'infra')
                ? <div className="ad-empty">No hay puntos de infraestructura registrados aún.</div>
                : (
                  <div className="mapa-admin-wrap" style={{ position:'relative' }}>
                    <button
                      className="admin-tile-btn"
                      onClick={() => setMapTileLayer(t => t === 'osm' ? 'sat' : 'osm')}
                      title={mapTileLayer === 'osm' ? 'Cambiar a satélite' : 'Cambiar a mapa'}
                      aria-label={mapTileLayer === 'osm' ? 'Cambiar a vista satélite' : 'Cambiar a mapa base'}
                    >
                      {mapTileLayer === 'osm'
                        ? <><Icon name="satellite" size={14}/> Satélite</>
                        : <><Icon name="map" size={14}/> Mapa</>}
                    </button>
                    {mapView === 'score' && (
                      <div className="map-score-legend-sticky">
                        <span><span className="msl-dot" style={{background:'#15803d'}}/>Alto ≥12</span>
                        <span><span className="msl-dot" style={{background:'#6366f1'}}/>Medio ≥8</span>
                        <span><span className="msl-dot" style={{background:'#b45309'}}/>Bajo &lt;8</span>
                      </div>
                    )}
                    <MapContainer center={mapCenter} zoom={15} style={{ height:'520px', width:'100%' }}>
                      <TileLayer
                        url={mapTileLayer === 'sat'
                          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
                        attribution={mapTileLayer === 'sat'
                          ? '&copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP'
                          : '&copy; OpenStreetMap'}
                      />
                      {mapFlyTarget && <AdminFlyTo target={mapFlyTarget} />}
                      {mapView === 'infra' && <ClusterLayer points={filtered} onDetail={rid => setDetail(records.find(r => r.id === rid) ?? null)} />}
                      {mapView === 'score' && scoreManzanas.map(mz => {
                        const col = mz.total >= 12 ? '#15803d' : mz.total >= 8 ? '#6366f1' : '#b45309'
                        const focused = scoreFocus?.id === mz.id
                        return (
                          <CircleMarker key={mz.id} center={[mz.lat, mz.lng]}
                            radius={focused ? 17 : 11}
                            pathOptions={{ color: col, fillColor: col, fillOpacity: focused ? 0.92 : 0.65, weight: focused ? 3 : 1.5 }}
                            eventHandlers={{ click: () => { setScoreFocus(mz); setDetail(records.find(r => r.id === mz.id) ?? null) } }}
                          >
                            <Popup><b>Mz {mz.manzana}</b><br/>{mz.vialidad}<br/>Puntaje: <b>{mz.total.toFixed(2)}</b></Popup>
                          </CircleMarker>
                        )
                      })}
                    </MapContainer>
                  </div>
                )
              }

              {/* ── Ranking de puntajes ── */}
              {mapView === 'score' && scoreManzanas.length > 0 && (
                <div className="score-ranking">
                  <div className="score-ranking-head">
                    <span>Ranking — {scoreManzanas.length} manzanas con infraestructura</span>
                    <span className="score-ranking-hint">Toca una fila para ubicar en el mapa</span>
                  </div>
                  <div className="score-ranking-list">
                    {[...scoreManzanas].sort((a, b) => b.total - a.total).map((mz, i) => {
                      const color = mz.total >= 12 ? '#15803d' : mz.total >= 8 ? '#6366f1' : '#b45309'
                      const label = mz.total >= 12 ? 'Alto' : mz.total >= 8 ? 'Medio' : 'Bajo'
                      const isFocused = scoreFocus?.id === mz.id
                      return (
                        <div key={mz.id} className={`score-ranking-row${isFocused ? ' srr-focused' : ''}`}>
                          <button
                            className="srr-main"
                            onClick={() => {
                              setScoreFocus(mz)
                              setMapFlyTarget([mz.lat, mz.lng])
                            }}
                          >
                            <span className="srr-rank">#{i + 1}</span>
                            <span className="srr-badge" style={{ background: color }}>{label}</span>
                            <span className="srr-mz">Mz {mz.manzana}</span>
                            <span className="srr-via">{mz.vialidad}</span>
                            <span className="srr-score" style={{ color }}>{mz.total.toFixed(2)}</span>
                          </button>
                          <button
                            className="srr-detail-btn"
                            onClick={() => setDetail(records.find(r => r.id === mz.id) ?? null)}
                          >
                            Detalle
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ══ ESTADÍSTICAS ══ */}
        {tab==='stats' && !loading && (
          <div>
            {/* Filtro de período para gráficas */}
            {(() => {
              const t = new Date(), todayS = t.toISOString().slice(0,10)
              const f7 = new Date(t); f7.setDate(t.getDate()-6)
              const weekS = f7.toISOString().slice(0,10)
              const mthS = new Date(t.getFullYear(),t.getMonth(),1).toISOString().slice(0,10)
              const hasFilter = !!(statsFrom || statsTo)
              const isHoy = statsFrom===todayS && statsTo===todayS
              const is7d  = statsFrom===weekS  && statsTo===todayS
              const isMes = statsFrom===mthS   && statsTo===todayS
              return (
                <div className={`sfb${hasFilter?' sfb--active':''}`}>
                  <div className="sfb-hd">
                    <span className="sfb-icon"><Icon name="calendar" size={14}/></span>
                    <span className="sfb-title">Período</span>
                    {hasFilter && chartRecords.length!==records.length && (
                      <span className="sfb-badge">{chartRecords.length} / {records.length}</span>
                    )}
                    <span className="sfb-gap"/>
                    {hasFilter
                      ? <button className="sfb-clear" onClick={()=>{setStatsFrom('');setStatsTo('')}}><Icon name="close" size={11}/> Ver todo</button>
                      : <span className="sfb-hint">Elige un rango para filtrar las gráficas</span>
                    }
                  </div>
                  <div className="sfb-body">
                    <div className="sfb-presets">
                      <button className={`sfb-pill${isHoy?' sfb-pill--on':''}`} onClick={()=>{setStatsFrom(todayS);setStatsTo(todayS)}}>Hoy</button>
                      <button className={`sfb-pill${is7d?' sfb-pill--on':''}`} onClick={()=>{setStatsFrom(weekS);setStatsTo(todayS)}}>7 días</button>
                      <button className={`sfb-pill${isMes?' sfb-pill--on':''}`} onClick={()=>{setStatsFrom(mthS);setStatsTo(todayS)}}>Este mes</button>
                    </div>
                    <div className="sfb-range">
                      <label className="sfb-dt">
                        <span>Desde</span>
                        <input type="date" value={statsFrom} onChange={e=>setStatsFrom(e.target.value)}/>
                      </label>
                      <span className="sfb-arr" aria-hidden="true">→</span>
                      <label className="sfb-dt">
                        <span>Hasta</span>
                        <input type="date" value={statsTo} onChange={e=>setStatsTo(e.target.value)}/>
                      </label>
                    </div>
                  </div>
                </div>
              )
            })()}
            <div className="ad-cards">
              <StatCard value={stats?.n??0}     label="Total registros"      color="#6366f1" icon="barChart" />
              <StatCard value={stats?.avgT??'—'} label="Promedio total"       sub="servicios + equipamiento" color="#0284c7" icon="list"
                tip={"Puntaje total = servicios + equipamiento\nRango posible: 0 – 15.08\n(máx 6.08 servicios + 9 equipamiento)"} />
              <StatCard value={stats?.avgS??'—'} label="Prom. servicios"      sub="máx 6.08" color="#15803d" icon="check"
                tip={"Suma de pesos de 8 servicios:\nBueno = 0.76   Regular = 0.70\nMalo = 0.64    Ninguno = 1.00\nMáximo posible: 6.08 pts"} />
              <StatCard value={stats?.avgE??'—'} label="Prom. equipamiento"   sub="máx 9"    color="#b45309" icon="grid"
                tip={"Equipamientos presentes:\nSí hay = 1 pt · No hay = 0\n9 tipos posibles\nMáximo: 9 pts"} />
            </div>
            {(!stats||stats.n===0) && <div className="ad-empty">No hay registros aún.</div>}
            {stats && stats.n>0 && (<>
              {timeChartData.length>0 && (
                <>
                  <h2 className="ad-sect">Registros por día</h2>
                  <div className="ad-chart-wrap">
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={timeChartData} margin={{ top:10, right:20, left:0, bottom:0 }}>
                        <defs>
                          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5"/>
                        <XAxis dataKey="fecha" tick={{ fontSize:12 }}/>
                        <YAxis allowDecimals={false} tick={{ fontSize:12 }}/>
                        <Tooltip {...TOOLTIP_PROPS}/>
                        <Area type="monotone" dataKey="count" name="Registros" stroke="#6366f1" fill="url(#cg)" strokeWidth={2}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
              {/* ── 2-col desktop: Servicios + Equipamiento ── */}
              <div className="ad-charts-2col">
                <div>
                  <h2 className="ad-sect">Calidad de Servicios <InfoTooltip text={"Manzanas por calificación de\ncada servicio: Bueno, Regular,\nMalo o Ninguno.\n\nBarras apiladas — más verde\n= mejor estado general."} /></h2>
                  <div className="ad-chart-wrap">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={servChartData} layout="vertical" margin={{ top:5, right:30, left:0, bottom:5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5"/>
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize:12 }}/>
                        <YAxis type="category" dataKey="label" tick={{ fontSize:12 }} width={100}/>
                        <Tooltip {...TOOLTIP_PROPS}/><Legend/>
                        <Bar dataKey="B" name="Bueno"   stackId="a" fill="#15803d"/>
                        <Bar dataKey="R" name="Regular" stackId="a" fill="#b45309"/>
                        <Bar dataKey="M" name="Malo"    stackId="a" fill="#b91c1c"/>
                        <Bar dataKey="N" name="Ninguno" stackId="a" fill="#a3a3a3" radius={[0,4,4,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <h2 className="ad-sect">Equipamiento Urbano <InfoTooltip text={"Presencia o ausencia de cada\ntipo de equipamiento urbano:\nescuelas, transporte, comercios,\ndeporte, salud, teléfono, etc."} /></h2>
                  <div className="ad-chart-wrap">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={equipChartData} layout="vertical" margin={{ top:5, right:30, left:0, bottom:5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5"/>
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize:12 }}/>
                        <YAxis type="category" dataKey="label" tick={{ fontSize:12 }} width={100}/>
                        <Tooltip {...TOOLTIP_PROPS}/><Legend/>
                        <Bar dataKey="Sí" fill="#15803d" radius={[0,4,4,0]}/>
                        <Bar dataKey="No" fill="#e5e5e5" radius={[0,4,4,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ── 2-col desktop: Puntaje + Calidad Promedio ── */}
              <div className="ad-charts-2col">
                <div>
                  <h2 className="ad-sect">Puntaje por manzana <InfoTooltip text={"Barras apiladas por manzana:\nMorado = servicios (máx 6.08)\nAzul = equipamiento (máx 9)\nTotal = suma de ambos."} /></h2>
                  <div className="ad-chart-wrap">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={[...records].sort((a,b)=>Number(a.manzana)-Number(b.manzana)).map(r=>({
                          manzana:`Mz ${r.manzana}`,
                          Servicios: Number(r.subtotal_servicios).toFixed(2),
                          Equipamiento: r.subtotal_equipamiento,
                        }))}
                        margin={{ top:5, right:20, left:0, bottom:50 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5"/>
                        <XAxis dataKey="manzana" tick={{ fontSize:11 }} angle={-35} textAnchor="end"/>
                        <YAxis tick={{ fontSize:12 }}/><Tooltip {...TOOLTIP_PROPS}/><Legend/>
                        <Bar dataKey="Servicios"    fill="#6366f1" radius={[4,4,0,0]}/>
                        <Bar dataKey="Equipamiento" fill="#0284c7" radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <h2 className="ad-sect">Calidad Promedio por Servicio <InfoTooltip text={"Porcentaje de calidad promedio:\nBueno = 100%   Regular = 70%\nMalo = 30%    Ninguno = 0%\n\nVerde ≥70% · Morado ≥40% · Rojo <40%"} /></h2>
                  <div className="ad-chart-wrap">
                    <p style={{ fontSize:'.75rem', color:'#a3a3a3', marginBottom:'.5rem', marginLeft:'.5rem' }}>
                      100% = todos Bueno · 0% = todos Ninguno
                    </p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={radarData} layout="vertical" margin={{ top:4, right:50, left:0, bottom:4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false}/>
                        <XAxis type="number" domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{ fontSize:11 }}/>
                        <YAxis type="category" dataKey="label" tick={{ fontSize:12 }} width={110}/>
                        <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [`${v}%`, 'Calidad']}/>
                        <Bar dataKey="calidad" name="Calidad" radius={[0,6,6,0]}>
                          {radarData.map((entry, i) => (
                            <Cell key={i} fill={entry.calidad >= 70 ? '#15803d' : entry.calidad >= 40 ? '#6366f1' : '#b91c1c'}/>
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ── 2-col desktop: Vialidad + Top manzanas ── */}
              {(vialidadPieData.length > 0 || topManzanas.length > 0) && (
                <div className="ad-charts-2col">
                  {vialidadPieData.length > 0 && (
                    <div>
                      <h2 className="ad-sect">Distribución por Tipo de Vialidad <InfoTooltip text={"Proporción de manzanas según\nel tipo de vía que las bordea:\nCalle · Avenida · Boulevard\nCallejón · Cerrada · Calzada\nCarretera"} /></h2>
                      <div className="ad-chart-wrap" style={{ display:'flex', alignItems:'center', gap:'1.5rem', flexWrap:'wrap' }}>
                        <ResponsiveContainer width="100%" height={windowWidth < 540 ? 200 : 260}>
                          <PieChart>
                            <Pie
                              data={vialidadPieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={windowWidth < 540 ? 40 : 60}
                              outerRadius={windowWidth < 540 ? 70 : 100}
                              paddingAngle={3}
                              dataKey="value"
                              label={windowWidth >= 540 ? ({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%` : false}
                              labelLine={windowWidth >= 540}
                            >
                              {vialidadPieData.map((_, i) => (
                                <Cell key={i} fill={['#6366f1','#0284c7','#15803d','#b45309','#dc2626','#7c3aed','#0891b2'][i % 7]}/>
                              ))}
                            </Pie>
                            <Tooltip {...TOOLTIP_PROPS} formatter={(v, n) => [v, n]}/>
                            {windowWidth < 540 && <Legend/>}
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {topManzanas.length > 0 && (
                    <div>
                      <h2 className="ad-sect">Top {topManzanas.length} Manzanas — Mayor Puntaje Total <InfoTooltip text={"Manzanas con mayor puntaje\ntotal (servicios + equipamiento):\n\nVerde  = Alto  ≥12 pts\nMorado = Medio ≥8 pts\nNaranja = Bajo  <8 pts"} /></h2>
                      <div className="ad-chart-wrap">
                        <ResponsiveContainer width="100%" height={Math.max(200, topManzanas.length * 36)}>
                          <BarChart
                            data={topManzanas}
                            layout="vertical"
                            margin={{ top:5, right:50, left:0, bottom:5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false}/>
                            <XAxis type="number" domain={[0,'auto']} tick={{ fontSize:12 }}/>
                            <YAxis type="category" dataKey="manzana" tick={{ fontSize:12 }} width={58}/>
                            <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [v, 'Puntaje total']}/>
                            <Bar dataKey="total" name="Puntaje" radius={[0,6,6,0]}>
                              {topManzanas.map((entry, i) => (
                                <Cell key={i} fill={entry.fill}/>
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', padding:'.5rem .75rem 0', fontSize:'.75rem', color:'#737373' }}>
                          <span><Icon name="dot" size={10} style={{color:'#15803d'}}/> Alto (≥12)</span>
                          <span><Icon name="dot" size={10} style={{color:'#6366f1'}}/> Medio (≥8)</span>
                          <span><Icon name="dot" size={10} style={{color:'#b45309'}}/> Bajo (&lt;8)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {manzanasSinInfra.length > 0 && (
                <div className="alert-no-infra">
                  <div className="alert-no-infra-head">
                    <span className="alert-no-infra-icon"><Icon name="warning" size={20}/></span>
                    <div>
                      <strong>{manzanasSinInfra.length} manzana{manzanasSinInfra.length !== 1 ? 's' : ''} sin infraestructura mapeada</strong>
                      <span>Estas manzanas tienen registro completo pero no tienen puntos en el mapa</span>
                    </div>
                  </div>
                  <div className="alert-no-infra-list">
                    {manzanasSinInfra.map(r => (
                      <button
                        key={r.id}
                        className="alert-no-infra-chip"
                        onClick={() => setDetail(r)}
                        title={`${TIPO_LABELS[r.tipo_vialidad] ?? r.tipo_vialidad} ${r.nombre_vialidad}`}
                      >
                        Mz {r.manzana}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>)}
          </div>
        )}

        {/* ══ REGISTROS ══ */}
        {tab==='records' && !loading && (
          <div>
            {/* Toolbar */}
            <div className="rec-toolbar">
              <input
                className="rec-search"
                placeholder="Buscar manzana, vialidad…"
                aria-label="Buscar registros"
                value={searchRaw}
                onChange={e => setSearchRaw(e.target.value)}
              />
              <label className="rec-date-label">
                <span>Desde</span>
                <input type="date" className="rec-date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </label>
              <label className="rec-date-label">
                <span>Hasta</span>
                <input type="date" className="rec-date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </label>
              {(searchRaw||search||dateFrom||dateTo) && (
                <button className="rec-clear" onClick={() => { setSearchRaw(''); setSearch(''); setDateFrom(''); setDateTo('') }}><Icon name="close" size={12}/> Limpiar</button>
              )}
              <div className="rec-toolbar-right">
                <span className="ad-records-count">
                  {filteredRecords.length !== records.length
                    ? `${filteredRecords.length} de ${records.length}`
                    : `${records.length} registro${records.length!==1?'s':''}`}
                </span>
                {records.length > 0 && (
                  <div className="export-wrap" ref={exportRef}>
                    <button className="btn-export-main" onClick={() => setExportOpen(o => !o)}>
                      <Icon name="download" size={13}/> Exportar <Icon name="chevron" size={11}/>
                    </button>
                    {exportOpen && (
                      <div className="export-dropdown">
                        {selectedIds.size > 0 && <>
                          <div className="export-divider">Selección ({selectedIds.size})</div>
                          <button className="export-opt export-opt-sel" onClick={() => { const s=filteredRecords.filter(r=>selectedIds.has(r.id)); exportXLSX(s); showToast(`Excel de ${s.length} registros`); setExportOpen(false) }}><Icon name="download" size={13}/> Excel — selección</button>
                          <button className="export-opt export-opt-sel" onClick={() => { const s=filteredRecords.filter(r=>selectedIds.has(r.id)); exportCSV(s); showToast(`CSV de ${s.length} registros`); setExportOpen(false) }}><Icon name="download" size={13}/> CSV — selección</button>
                          <div className="export-divider">Todo ({filteredRecords.length})</div>
                        </>}
                        <button className="export-opt" onClick={() => { exportXLSX(filteredRecords); showToast('Excel descargado'); setExportOpen(false) }}><Icon name="download" size={13}/> Excel (.xlsx)</button>
                        <button className="export-opt" onClick={() => { exportCSV(filteredRecords); showToast('CSV descargado'); setExportOpen(false) }}><Icon name="download" size={13}/> CSV</button>
                        <button className="export-opt" onClick={() => { exportGeoJSON(filteredRecords); showToast('GeoJSON descargado'); setExportOpen(false) }}><Icon name="download" size={13}/> GeoJSON</button>
                        <button className="export-opt" onClick={() => { exportDXF(filteredRecords, showToast, () => showToast('DXF descargado')); setExportOpen(false) }}><Icon name="download" size={13}/> DXF (AutoCAD)</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {records.length > 0 && (
              <div className="rec-view-toggle">
                <button className={`rec-vt-btn ${recView==='table'?'rec-vt-active':''}`} onClick={() => setRecView('table')}><Icon name="table" size={14}/> Tabla</button>
                <button className={`rec-vt-btn ${recView==='cards'?'rec-vt-active':''}`} onClick={() => setRecView('cards')}><Icon name="grid" size={14}/> Tarjetas</button>
              </div>
            )}

            {filteredRecords.length === 0 ? (
              <div className="ad-empty">
                <span className="ad-empty-icon" aria-hidden="true"><Icon name={search||dateFrom||dateTo ? 'close' : 'list'} size={32}/></span>
                <span>{search||dateFrom||dateTo ? 'Sin resultados para esa búsqueda.' : 'No hay registros aún.'}</span>
                {(search||dateFrom||dateTo) && <span className="ad-empty-hint">Prueba con otro término o limpia los filtros.</span>}
              </div>
            ) : (
              <>
                {/* Bulk action bar */}
                {selectedIds.size > 0 && (
                  <div className="bulk-bar">
                    <span className="bulk-count">{selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
                    <button className="bulk-btn" onClick={() => { const s=filteredRecords.filter(r=>selectedIds.has(r.id)); exportXLSX(s); showToast(`Excel de ${s.length} registros`) }}><Icon name="download" size={12}/> Excel</button>
                    <button className="bulk-btn" onClick={() => { const s=filteredRecords.filter(r=>selectedIds.has(r.id)); exportCSV(s); showToast(`CSV de ${s.length} registros`) }}><Icon name="download" size={12}/> CSV</button>
                    <button className="bulk-clear" onClick={() => setSelectedIds(new Set())} aria-label="Deseleccionar todo"><Icon name="close" size={12}/> Deseleccionar</button>
                  </div>
                )}

                {recView === 'table' ? (
                  <div className="ad-table-wrap">
                    <table className="ad-table" aria-label="Registros catastrales">
                      <thead>
                        <tr>
                          <th scope="col" className="th-check">
                            <input type="checkbox" aria-label="Seleccionar toda la página"
                              checked={allPageSelected} ref={el => { if (el) el.indeterminate = somePageSelected }}
                              onChange={toggleSelectAll} />
                          </th>
                          <th scope="col" className="th-sort" onClick={() => toggleSort('fecha')}>Fecha{sortIcon('fecha')}</th>
                          <th scope="col" className="th-sort" onClick={() => toggleSort('manzana')}>Manzana{sortIcon('manzana')}</th>
                          <th scope="col">Vialidad</th>
                          <th scope="col" className="th-sort" onClick={() => toggleSort('servicios')}>Servicios{sortIcon('servicios')}<InfoTooltip text={"Subtotal de servicios (máx 6.08)\nPeso por calificación:\nBueno = 0.76   Regular = 0.70\nMalo = 0.64    Ninguno = 1.00\npor cada uno de los 8 servicios."} /></th>
                          <th scope="col" className="th-sort" onClick={() => toggleSort('equip')}>Equip.{sortIcon('equip')}<InfoTooltip text={"Equipamientos presentes (máx 9):\nSí hay = 1 pt\nNo hay = 0 pts\n\n9 tipos posibles."} /></th>
                          <th scope="col" className="th-sort" onClick={() => toggleSort('total')}>Total{sortIcon('total')}<InfoTooltip text={"Puntaje total de la manzana:\nServicios + Equipamiento\nRango: 0 – 15.08\n\nAlto ≥12 · Medio ≥8 · Bajo <8"} /></th>
                          <th scope="col"><span className="sr-only">Acciones</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRecords.map(r => (
                          <tr key={r.id} className={`ad-tr-hover${selectedIds.has(r.id)?' tr-selected':''}`} onClick={() => setDetail(r)} style={{ cursor:'pointer' }}>
                            <td className="td-check" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" aria-label={`Seleccionar manzana ${r.manzana}`}
                                checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                            </td>
                            <td className="ad-td-date" title={new Date(r.created_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}>
                              {relativeDate(r.created_at)}
                            </td>
                            <td><b>{r.manzana}</b></td>
                            <td>{TIPO_LABELS[r.tipo_vialidad]??r.tipo_vialidad} {r.nombre_vialidad}</td>
                            <td>{Number(r.subtotal_servicios).toFixed(2)}</td>
                            <td>{r.subtotal_equipamiento}</td>
                            <td><b>{Number(r.total).toFixed(2)}</b></td>
                            <td onClick={e => e.stopPropagation()} className="td-actions">
                              <button className="btn-row-edit" title="Editar" aria-label="Editar registro" onClick={() => setEditing(r)}><Icon name="edit" size={13}/></button>
                              <button className="btn-row-del"  title="Eliminar" aria-label="Eliminar registro" onClick={() => setDeleting(r)}><Icon name="close" size={13}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="ad-table-hint">Clic en una fila para ver el detalle completo</p>
                  </div>
                ) : (
                  <div className="rec-cards-grid">
                    {pagedRecords.map(r => {
                      const colorScore = Number(r.total) >= 12 ? '#15803d' : Number(r.total) >= 8 ? '#6366f1' : '#b45309'
                      const labelScore = Number(r.total) >= 12 ? 'Alto' : Number(r.total) >= 8 ? 'Medio' : 'Bajo'
                      return (
                        <div key={r.id} className="rec-card" onClick={() => setDetail(r)}>
                          <div className="rec-card-header">
                            <div>
                              <span className="rec-card-mz">Mz {r.manzana}</span>
                              <span className="rec-card-via">{TIPO_LABELS[r.tipo_vialidad]??r.tipo_vialidad} {r.nombre_vialidad}</span>
                            </div>
                            <span className="rec-card-score" style={{ color: colorScore }}>{Number(r.total).toFixed(1)}</span>
                          </div>
                          <div className="rec-card-meta">
                            <span className="rec-card-badge" style={{ background: colorScore }}>{labelScore}</span>
                            <span className="rec-card-date" title={new Date(r.created_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })}>{relativeDate(r.created_at)}</span>
                          </div>
                          <div className="rec-card-scores">
                            <div><span>Servicios</span><b>{Number(r.subtotal_servicios).toFixed(2)}</b></div>
                            <div><span>Equipamiento</span><b>{r.subtotal_equipamiento}</b></div>
                            <div><span>Infra pts</span><b>{Array.isArray(r.infra_mapa) ? r.infra_mapa.length : 0}</b></div>
                          </div>
                          <div className="rec-card-actions" onClick={e => e.stopPropagation()}>
                            <button className="btn-row-edit" aria-label="Editar registro" onClick={() => setEditing(r)}><Icon name="edit" size={13}/> Editar</button>
                            <button className="btn-row-del" aria-label="Eliminar registro" onClick={() => setDeleting(r)}><Icon name="close" size={13}/> Eliminar</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Paginación + items por página */}
                <div className="pagination-row">
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button className="pg-btn" disabled={page===1} aria-label="Primera página" onClick={() => setPage(1)}>«</button>
                      <button className="pg-btn" disabled={page===1} aria-label="Página anterior" onClick={() => setPage(p=>p-1)}>‹</button>
                      <span className="pg-info">Página {page} de {totalPages}</span>
                      <button className="pg-btn" disabled={page===totalPages} aria-label="Página siguiente" onClick={() => setPage(p=>p+1)}>›</button>
                      <button className="pg-btn" disabled={page===totalPages} aria-label="Última página" onClick={() => setPage(totalPages)}>»</button>
                    </div>
                  )}
                  <label className="pg-size-label">
                    Mostrar
                    <select className="pg-size-select" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} aria-label="Registros por página">
                      {[20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    por página
                  </label>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
