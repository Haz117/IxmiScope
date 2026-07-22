import { useState, useEffect, lazy, Suspense, Component } from 'react'
import FormCatastro from './components/FormCatastro'
import { supabase, isConfigured, getLocalSession, clearLocalSession } from './lib/supabase'
import logoSrc from './assets/logo.png'
import './App.css'

const AdminLogin     = lazy(() => import('./components/AdminLogin'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))

function isChunkError(error) {
  const msg = error?.message ?? ''
  return msg.includes('preload') || msg.includes('dynamically imported') ||
         msg.includes('Failed to fetch') || msg.includes('Importing a module script failed')
}

class ErrorBoundary extends Component {
  state = { error: null, chunk: false }
  static getDerivedStateFromError(error) { return { error, chunk: isChunkError(error) } }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
    // Chunk error = nueva versión desplegada con nuevos hashes de assets.
    // Recargamos automáticamente una sola vez para que el SW descargue el bundle nuevo.
    if (isChunkError(error)) {
      const reloaded = sessionStorage.getItem('chunk_reload')
      if (!reloaded) { sessionStorage.setItem('chunk_reload', '1'); window.location.reload() }
    }
  }
  render() {
    if (this.state.error) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:'100vh', background:'#0a0a0a', color:'#fff', gap:'16px', padding:'2rem', textAlign:'center' }}>
        <h2 style={{ fontSize:'1.1rem', fontWeight:700 }}>
          {this.state.chunk ? 'Nueva versión disponible' : 'Algo salió mal'}
        </h2>
        <p style={{ color:'#737373', fontSize:'.85rem', maxWidth:'340px' }}>
          {this.state.chunk
            ? 'Se desplegó una actualización. Recarga la página para continuar.'
            : this.state.error.message}
        </p>
        <button
          onClick={() => this.state.chunk ? window.location.reload() : this.setState({ error: null, chunk: false })}
          style={{ padding:'.5rem 1.5rem', borderRadius:'8px', border:'1px solid #333',
            background:'#1a1a1a', color:'#fff', cursor:'pointer', fontSize:'.9rem' }}>
          {this.state.chunk ? 'Recargar' : 'Reintentar'}
        </button>
      </div>
    )
    return this.props.children
  }
}

function Splash({ exiting }) {
  return (
    <div className={`splash${exiting ? ' splash-exit' : ''}`}>
      <div className="splash-ambient" />
      <div className="splash-ambient sp-ambient-2" />
      <div className="splash-ambient sp-ambient-3" />
      <div className="splash-center">
        <div className="splash-ring sp-ring-1" />
        <div className="splash-ring sp-ring-2" />
        <div className="splash-ring sp-ring-3" />
        <div className="splash-ring sp-ring-4" />
        <span className="sp-particle sp-p-1" aria-hidden="true"/>
        <span className="sp-particle sp-p-2" aria-hidden="true"/>
        <span className="sp-particle sp-p-3" aria-hidden="true"/>
        <span className="sp-particle sp-p-4" aria-hidden="true"/>
        <span className="sp-particle sp-p-5" aria-hidden="true"/>
        <div className="splash-logo-card">
          <div className="splash-logo-shine" />
          <img src={logoSrc} className="splash-logo" alt="" />
        </div>
      </div>
      <div className="splash-copy">
        <div className="splash-wm-wrap">
          <p className="splash-wordmark">Catastro</p>
          <span className="splash-wm-shine" aria-hidden="true"/>
        </div>
        <p className="splash-subtitle">Sistema Catastral Municipal</p>
        <p className="splash-city">Ixmiquilpan &middot; Hidalgo</p>
      </div>
      <div className="splash-progress">
        <div className="splash-progress-fill" />
      </div>
    </div>
  )
}

function AdminFallback() {
  return <Splash />
}

export default function App() {
  const [view, setView]       = useState('form') // 'form' | 'admin'
  const [session, setSession] = useState(() => getLocalSession())
  const [authReady, setAuthReady] = useState(!isConfigured)
  const [splashPhase, setSplashPhase] = useState('in') // 'in' | 'out' | 'done'

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t1 = setTimeout(() => setSplashPhase('out'),  reduced ? 100 : 800)
    const t2 = setTimeout(() => setSplashPhase('done'), reduced ? 150 : 1300)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (!isConfigured) return

    supabase.auth.getSession()
      .then(({ data: { session } }) => { setSession(session); setAuthReady(true) })
      .catch(() => setAuthReady(true))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!authReady || splashPhase !== 'done') return <Splash exiting={splashPhase === 'out'} />

  async function handleLogout() {
    if (isConfigured) await supabase.auth.signOut()
    clearLocalSession()
    setSession(null)
    setView('form')
  }

  if (view === 'admin') {
    if (!session) return (
      <ErrorBoundary>
        <div key="login" className="app-view">
          <Suspense fallback={<AdminFallback />}>
            <AdminLogin onBack={() => setView('form')} onLoginLocal={(s) => { setSession(s); setView('admin') }} />
          </Suspense>
        </div>
      </ErrorBoundary>
    )
    return (
      <ErrorBoundary>
        <div key="admin" className="app-view">
          <Suspense fallback={<AdminFallback />}>
            <AdminDashboard session={session} onLogout={handleLogout} onBack={() => setView('form')} />
          </Suspense>
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div key="form" className="app-view">
        <FormCatastro onAdminClick={() => setView('admin')} isAdmin={false} />
      </div>
    </ErrorBoundary>
  )
}
