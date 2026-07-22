import { useState, useRef } from 'react'
import { supabase, isConfigured, setLocalSession } from '../lib/supabase'
import { IconAppLogo } from './Icons'
import './AdminLogin.css'

export default function AdminLogin({ onBack, onLoginLocal }) {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const submitLock                = useRef(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitLock.current) return
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Ingresa un correo electrónico válido')
      return
    }
    if (isConfigured && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    submitLock.current = true
    setLoading(true)
    setError('')
    try {
      if (isConfigured) {
        const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
        if (error) setError(error.message)
      } else if (!import.meta.env.PROD) {
        setLocalSession(trimmedEmail)
        if (onLoginLocal) onLoginLocal({ user: { email: trimmedEmail } })
      } else {
        setError('Error de configuración. Contacta al administrador del sistema.')
      }
    } finally {
      submitLock.current = false
      setLoading(false)
    }
  }

  return (
    <div className="al-page">

      {/* Topbar — igual al del formulario */}
      <header className="al-topbar">
        <div className="al-topbar-inner">
          <div className="al-brand">
            <IconAppLogo size={26} />
            <span>Catastro</span>
          </div>
          <button className="al-back-btn" onClick={onBack}>
            ← Formulario
          </button>
        </div>
      </header>

      {/* Contenido centrado */}
      <div className="al-body">
        <div className="al-card">

          <div className="al-card-head">
            <div className="al-card-icon">
              <IconAppLogo size={36} />
            </div>
            <div>
              <h1>Acceso Admin</h1>
              <p className="al-sub">
                {isConfigured
                  ? 'Inicia sesión para gestionar los registros'
                  : 'Modo desarrollo — ingresa cualquier email'}
              </p>
            </div>
          </div>

          {!isConfigured && (
            <div className="al-warn">
              <b>Modo desarrollo.</b> Sin Supabase configurado. Cualquier email es válido para acceder al panel.
            </div>
          )}

          <form onSubmit={handleSubmit} className="al-form">
            <div className="al-field">
              <label htmlFor="al-email">Correo electrónico</label>
              <input
                id="al-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder={isConfigured ? 'admin@ixmiquilpan.gob.mx' : 'admin@local.dev'}
                autoComplete="email"
                required
                autoFocus
              />
            </div>
            <div className="al-field">
              <label htmlFor="al-password">Contraseña{!isConfigured && <span className="al-dev-note"> (ignorada en dev)</span>}</label>
              <div className="al-pwd-wrap">
                <input
                  id="al-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required={isConfigured}
                />
                <button
                  type="button"
                  className="al-pwd-toggle"
                  onClick={() => setShowPwd(p => !p)}
                  tabIndex={-1}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPwd
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            {error && <div className="al-error" role="alert">{error}</div>}
            <button type="submit" className="al-btn" disabled={loading}>
              {loading ? 'Verificando…' : 'Ingresar al panel'}
            </button>
          </form>

          <p className="al-footer">
            <button className="al-link" onClick={onBack}>← Volver al formulario de captura</button>
          </p>
        </div>
      </div>
    </div>
  )
}
