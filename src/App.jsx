import { useState, useEffect, lazy, Suspense, Component } from 'react'
import FormCatastro from './components/FormCatastro'
import { supabase, isConfigured, getLocalSession, clearLocalSession } from './lib/supabase'
import logoSrc from './assets/logo.png'
import './App.css'

const AdminLogin     = lazy(() => import('./components/AdminLogin'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info) }
  render() {
    if (this.state.error) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:'100vh', background:'#0a0a0a', color:'#fff', gap:'16px', padding:'2rem', textAlign:'center' }}>
        <h2 style={{ fontSize:'1.1rem', fontWeight:700 }}>Algo salió mal</h2>
        <p style={{ color:'#737373', fontSize:'.85rem', maxWidth:'340px' }}>{this.state.error.message}</p>
        <button onClick={() => this.setState({ error: null })}
          style={{ padding:'.5rem 1.5rem', borderRadius:'8px', border:'1px solid #333',
            background:'#1a1a1a', color:'#fff', cursor:'pointer', fontSize:'.9rem' }}>
          Reintentar
        </button>
      </div>
    )
    return this.props.children
  }
}

function Splash() {
  return (
    <div className="splash">
      <div className="splash-ambient" />
      <div className="splash-center">
        <div className="splash-ring sp-ring-1" />
        <div className="splash-ring sp-ring-2" />
        <div className="splash-logo-card">
          <img src={logoSrc} className="splash-logo" alt="" />
        </div>
      </div>
      <div className="splash-copy">
        <p className="splash-wordmark">Catastro</p>
        <p className="splash-city">Ixmiquilpan &middot; Hidalgo</p>
      </div>
      <div className="splash-dots">
        <span className="sp-dot" style={{ animationDelay: '0ms' }} />
        <span className="sp-dot" style={{ animationDelay: '180ms' }} />
        <span className="sp-dot" style={{ animationDelay: '360ms' }} />
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

  if (!authReady) return <Splash />

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
