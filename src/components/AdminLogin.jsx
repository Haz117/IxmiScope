import { useState } from 'react'
import { supabase, isConfigured, setLocalSession } from '../lib/supabase'
import './AdminLogin.css'

export default function AdminLogin({ onBack, onLoginLocal }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (isConfigured) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      // Local dev mode - accept any email
      if (!email || !email.includes('@')) {
        setError('Ingresa un email válido para modo desarrollo')
      } else {
        setLocalSession(email)
        if (onLoginLocal) onLoginLocal({ user: { email } })
      }
    }
    setLoading(false)
  }

  if (!isConfigured) {
    return (
      <div className="al-page">
        <div className="al-card">
          <button className="al-back" onClick={onBack}>← Volver al formulario</button>
          <div className="al-logo">Catastro</div>
          <h1>Acceso Admin</h1>
          <div className="al-warn" style={{ background: '#fef3c7', borderColor: '#f59e0b', marginBottom: '1.5rem' }}>
            <b>Modo desarrollo (sin Supabase).</b><br />
            Ingresa cualquier email para acceder al admin en modo local.
          </div>
          <form onSubmit={handleSubmit} className="al-form">
            <div className="al-field">
              <label>Correo electrónico (desarrollo)</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@local.dev"
                required
                autoFocus
              />
            </div>
            <div className="al-field">
              <label>Contraseña (ignorada)</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="(no requerida en modo dev)"
              />
            </div>
            {error && <div className="al-error">{error}</div>}
            <button type="submit" className="al-btn" disabled={loading}>
              {loading ? 'Ingresando…' : 'Acceder al admin'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="al-page">
      <div className="al-card">
        <button className="al-back" onClick={onBack}>← Volver al formulario</button>
        <div className="al-logo">Catastro</div>
        <h1>Acceso Admin</h1>
        <p className="al-sub">Inicia sesión para ver estadísticas y gestionar capturistas</p>

        <form onSubmit={handleSubmit} className="al-form">
          <div className="al-field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@catastro.gob.mx"
              required
              autoFocus
            />
          </div>
          <div className="al-field">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div className="al-error">{error}</div>}
          <button type="submit" className="al-btn" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
