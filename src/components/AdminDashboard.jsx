import { useState, useEffect, useMemo } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import './AdminDashboard.css'

const SERVICIOS_LIST = [
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

/* ── Stat card ── */
function StatCard({ value, label, sub }) {
  return (
    <div className="ad-card">
      <div className="ad-card-val">{value}</div>
      <div className="ad-card-lbl">{label}</div>
      {sub && <div className="ad-card-sub">{sub}</div>}
    </div>
  )
}

/* ── Stacked bar ── */
function DistBar({ segments }) {
  return (
    <div className="ad-bar">
      {segments.map((s, i) =>
        s.pct > 0 ? (
          <div
            key={i}
            className="ad-bar-seg"
            style={{ width: `${s.pct}%`, background: s.color }}
            title={`${s.label}: ${s.count} (${s.pct.toFixed(0)}%)`}
          />
        ) : null
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════ */
export default function AdminDashboard({ session, onLogout }) {
  const [tab, setTab]       = useState('stats')
  const [records, setRecords] = useState([])
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  // New user form
  const emptyUser = { nombre: '', email: '', municipio: '', cargo: '' }
  const [newUser, setNewUser]     = useState(emptyUser)
  const [savingUser, setSavingUser] = useState(false)
  const [userMsg, setUserMsg]     = useState(null) // {type:'ok'|'err', text}

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!isConfigured || !supabase) return
    const channel = supabase
      .channel('registros-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registros' },
        (payload) => { setRecords(prev => [payload.new, ...prev]) }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    
    if (!isConfigured) {
      // Development mode: load demo data for local testing
      const mockRecords = [
        {
          id: 1,
          manzana: 42,
          tipo_vialidad: 'CAL',
          nombre_vialidad: 'Principal',
          subtotal_servicios: 4.68,
          subtotal_equipamiento: 6,
          total: 10.68,
          created_at: new Date().toISOString(),
          servicios: { aguaPotable: 'B', drenaje: 'B', alcantarillado: 'R', electrificacion: 'B', guarniciones: 'B', banquetas: 'B', pavimento: 'B', recoleccionBasura: 'N' },
          equipamiento: { educacionCultura: '1', transportePublico: '1', comercioAbasto: '1', recreacionDeporte: '0', saludAsistencia: '1', telefono: '1', correosYTelegrafo: '0', contaminacion: '0', calleEspecial: '0' },
        },
        {
          id: 2,
          manzana: 15,
          tipo_vialidad: 'AVE',
          nombre_vialidad: 'Independencia',
          subtotal_servicios: 3.80,
          subtotal_equipamiento: 4,
          total: 7.80,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          servicios: { aguaPotable: 'B', drenaje: 'R', alcantarillado: 'R', electrificacion: 'B', guarniciones: 'B', banquetas: 'M', pavimento: 'R', recoleccionBasura: 'B' },
          equipamiento: { educacionCultura: '1', transportePublico: '0', comercioAbasto: '1', recreacionDeporte: '1', saludAsistencia: '0', telefono: '1', correosYTelegrafo: '1', contaminacion: '0', calleEspecial: '0' },
        },
      ]
      setRecords(mockRecords)
      setUsers([
        { id: 1, nombre: 'Carlos Gómez', email: 'carlos@catastro.gob.mx', municipio: 'Centro', cargo: 'Capturista', activo: true },
        { id: 2, nombre: 'María López', email: 'maria@catastro.gob.mx', municipio: 'Norte', cargo: 'Capturista', activo: true },
      ])
      setLoading(false)
      return
    }

    // Production: fetch data from Supabase
    const [{ data: recs, error: rErr }, { data: usrs, error: uErr }] = await Promise.all([
      supabase.from('registros').select('*').order('created_at', { ascending: false }),
      supabase.from('usuarios').select('*').order('created_at', { ascending: false }),
    ])
    const err = rErr || uErr
    if (err) {
      setError(`Error al cargar datos: ${err.message} (código: ${err.code ?? 'desconocido'})`)
      setLoading(false)
      return
    }
    setRecords(recs ?? [])
    setUsers(usrs ?? [])
    setLoading(false)
  }

  /* ── Computed stats ── */
  const stats = useMemo(() => {
    const n = records.length
    if (!n) return null
    const avgS = records.reduce((s, r) => s + (r.subtotal_servicios ?? 0), 0) / n
    const avgE = records.reduce((s, r) => s + (r.subtotal_equipamiento ?? 0), 0) / n
    const avgT = records.reduce((s, r) => s + (r.total ?? 0), 0) / n
    return { n, avgS: avgS.toFixed(2), avgE: avgE.toFixed(1), avgT: avgT.toFixed(2) }
  }, [records])

  function getServDist(key) {
    const cnt = { B: 0, R: 0, M: 0, N: 0 }
    records.forEach(r => { const v = r.servicios?.[key]; if (v in cnt) cnt[v]++ })
    const total = Object.values(cnt).reduce((a, b) => a + b, 0)
    return OPCIONES.map(o => ({ ...o, count: cnt[o.val], pct: total ? (cnt[o.val] / total * 100) : 0 }))
  }

  function getEquipDist(key) {
    let si = 0, no = 0
    records.forEach(r => { const v = r.equipamiento?.[key]; if (v === '1') si++; else if (v === '0') no++ })
    const total = si + no
    return [
      { label: 'Sí', count: si, pct: total ? (si / total * 100) : 0, color: '#15803d' },
      { label: 'No', count: no, pct: total ? (no / total * 100) : 0, color: '#e5e5e5' },
    ]
  }

  /* ── Create user ── */
  async function handleCreateUser(e) {
    e.preventDefault()
    setSavingUser(true)
    setUserMsg(null)
    
    if (!isConfigured) {
      // Mock: just add to local state
      setUsers([...users, { ...newUser, id: Date.now(), activo: true }])
      setUserMsg({ type: 'ok', text: 'Capturista creado correctamente (en modo dev).' })
      setNewUser(emptyUser)
      setSavingUser(false)
      return
    }
    
    const { error } = await supabase.from('usuarios').insert([newUser])
    if (error) {
      setUserMsg({ type: 'err', text: error.message })
    } else {
      setUserMsg({ type: 'ok', text: 'Capturista creado correctamente.' })
      setNewUser(emptyUser)
      loadData()
    }
    setSavingUser(false)
  }

  async function toggleActivo(user) {
    if (!isConfigured) {
      // Mock: toggle in local state
      setUsers(users.map(u => u.id === user.id ? { ...u, activo: !u.activo } : u))
      return
    }
    await supabase.from('usuarios').update({ activo: !user.activo }).eq('id', user.id)
    loadData()
  }

  /* ═══════════════════════ RENDER ═══════════════════════════ */
  return (
    <div className="ad-page">

      {/* Topbar */}
      <div className="ad-topbar">
        <div className="ad-topbar-inner">
          <span className="ad-brand">
            Catastro <span className="ad-tag">Admin</span>
          </span>
          <div className="ad-topbar-right">
            <span className="ad-email">{session?.user?.email}</span>
            <button className="ad-logout-btn" onClick={onLogout}>Cerrar sesión</button>
          </div>
        </div>
      </div>

      <div className="ad-body">

        {/* Demo mode indicator */}
        {!isConfigured && (
          <div className="ad-demo-banner">
            ⚠ Modo desarrollo — Los datos son de demostración. Se actualizarán cuando Supabase esté configurado.
          </div>
        )}

        {/* Tabs */}
        <nav className="ad-tabs">
          {[
            { key: 'stats',   label: 'Estadísticas' },
            { key: 'records', label: `Registros${stats ? ` (${stats.n})` : ''}` },
            { key: 'users',   label: `Capturistas${users.length ? ` (${users.length})` : ''}` },
          ].map(t => (
            <button
              key={t.key}
              className={`ad-tab ${tab === t.key ? 'ad-tab-on' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
          <button className="ad-refresh" onClick={loadData} title="Actualizar datos">↻</button>
        </nav>

        {loading && <div className="ad-loading">Cargando datos…</div>}
        {error   && <div className="ad-error">{error}</div>}

        {/* ══ TAB: ESTADÍSTICAS ══ */}
        {tab === 'stats' && !loading && (
          <div>
            <div className="ad-cards">
              <StatCard value={stats?.n ?? 0}     label="Total registros" />
              <StatCard value={stats?.avgT ?? '—'} label="Promedio total"  sub="servicios + equipamiento" />
              <StatCard value={stats?.avgS ?? '—'} label="Prom. servicios"  sub="máx 6.08" />
              <StatCard value={stats?.avgE ?? '—'} label="Prom. equipamiento" sub="máx 9" />
            </div>

            {(!stats || stats.n === 0) && (
              <div className="ad-empty">
                No hay registros aún. Los datos aparecerán aquí cuando se envíen formularios.
              </div>
            )}

            {stats && stats.n > 0 && (
              <>
                {/* Servicios */}
                <h2 className="ad-sect">Distribución de Servicios</h2>
                <div className="ad-legend">
                  {OPCIONES.map(o => (
                    <span key={o.val} className="ad-legend-item">
                      <span className="ad-legend-dot" style={{ background: o.color }} />
                      {o.label}
                    </span>
                  ))}
                </div>
                <div className="ad-dist-list">
                  {SERVICIOS_LIST.map(({ key, label }) => {
                    const segs = getServDist(key)
                    return (
                      <div key={key} className="ad-dist-row">
                        <span className="ad-dist-lbl">{label}</span>
                        <DistBar segments={segs} />
                        <div className="ad-dist-counts">
                          {segs.map(s => (
                            <span key={s.val} style={{ color: s.color }}>{s.label[0]}: {s.count}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Equipamiento */}
                <h2 className="ad-sect" style={{ marginTop: '2rem' }}>Distribución de Equipamiento</h2>
                <div className="ad-legend">
                  <span className="ad-legend-item"><span className="ad-legend-dot" style={{ background: '#15803d' }} />Sí hay</span>
                  <span className="ad-legend-item"><span className="ad-legend-dot" style={{ background: '#d4d4d4' }} />No hay</span>
                </div>
                <div className="ad-dist-list">
                  {EQUIPAMIENTO_LIST.map(({ key, label }) => {
                    const segs = getEquipDist(key)
                    return (
                      <div key={key} className="ad-dist-row">
                        <span className="ad-dist-lbl">{label}</span>
                        <DistBar segments={segs} />
                        <div className="ad-dist-counts">
                          <span style={{ color: '#15803d' }}>Sí: {segs[0].count}</span>
                          <span style={{ color: '#737373' }}>No: {segs[1].count}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ TAB: REGISTROS ══ */}
        {tab === 'records' && !loading && (
          <div>
            {records.length === 0 ? (
              <div className="ad-empty">No hay registros aún.</div>
            ) : (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Manzana</th>
                      <th>Vialidad</th>
                      <th>Servicios</th>
                      <th>Equip.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id}>
                        <td className="ad-td-date">
                          {new Date(r.created_at).toLocaleDateString('es-MX', {
                            day: '2-digit', month: 'short', year: 'numeric'
                          })}
                        </td>
                        <td><b>{r.manzana}</b></td>
                        <td>{r.tipo_vialidad} {r.nombre_vialidad}</td>
                        <td>{Number(r.subtotal_servicios).toFixed(2)}</td>
                        <td>{r.subtotal_equipamiento}</td>
                        <td><b>{Number(r.total).toFixed(2)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: CAPTURISTAS ══ */}
        {tab === 'users' && !loading && (
          <div>
            <h2 className="ad-sect" style={{ marginTop: 0 }}>Crear capturista</h2>
            <form className="ad-user-form" onSubmit={handleCreateUser}>
              <div className="ad-user-grid">
                {[
                  { field: 'nombre',    label: 'Nombre completo', placeholder: 'Ej. Ana García', required: true },
                  { field: 'email',     label: 'Correo (opcional)', placeholder: 'ana@catastro.gob.mx', type: 'email' },
                  { field: 'municipio', label: 'Municipio', placeholder: 'Ej. Hermosillo' },
                  { field: 'cargo',     label: 'Cargo', placeholder: 'Ej. Capturista de campo' },
                ].map(({ field, label, placeholder, required, type }) => (
                  <div key={field} className="ad-uf">
                    <label>{label}</label>
                    <input
                      type={type || 'text'}
                      value={newUser[field]}
                      onChange={e => setNewUser(p => ({ ...p, [field]: e.target.value }))}
                      placeholder={placeholder}
                      required={required}
                    />
                  </div>
                ))}
              </div>

              {userMsg && (
                <div className={`ad-user-msg ${userMsg.type === 'ok' ? 'msg-ok' : 'msg-err'}`}>
                  {userMsg.text}
                </div>
              )}

              <button type="submit" className="ad-user-btn" disabled={savingUser}>
                {savingUser ? 'Guardando…' : '+ Crear capturista'}
              </button>
            </form>

            <h2 className="ad-sect">Capturistas registrados</h2>
            {users.length === 0 ? (
              <div className="ad-empty">No hay capturistas registrados aún.</div>
            ) : (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Municipio</th>
                      <th>Cargo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td><b>{u.nombre}</b></td>
                        <td>{u.email || '—'}</td>
                        <td>{u.municipio || '—'}</td>
                        <td>{u.cargo || '—'}</td>
                        <td>
                          <button
                            className={`ad-status-btn ${u.activo ? 'status-on' : 'status-off'}`}
                            onClick={() => toggleActivo(u)}
                          >
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
