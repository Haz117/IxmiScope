import { useState, useEffect, lazy, Suspense } from 'react'
import FormCatastro from './components/FormCatastro'
import { supabase, isConfigured, getLocalSession, clearLocalSession } from './lib/supabase'
import './App.css'

const AdminLogin     = lazy(() => import('./components/AdminLogin'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))

function AdminFallback() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a0a' }}>
      <div style={{ width:'28px', height:'28px', border:'3px solid #333', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
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

  if (!authReady) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a0a' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
        <div style={{ width:'28px', height:'28px', border:'3px solid #333', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <span style={{ color:'#525252', fontSize:'.8rem', fontWeight:600, letterSpacing:'.05em' }}>CATASTRO</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  async function handleLogout() {
    if (isConfigured) await supabase.auth.signOut()
    clearLocalSession()
    setSession(null)
    setView('form')
  }

  if (view === 'admin') {
    if (!session) return (
      <div key="login" className="app-view">
        <Suspense fallback={<AdminFallback />}>
          <AdminLogin onBack={() => setView('form')} onLoginLocal={(s) => { setSession(s); setView('admin') }} />
        </Suspense>
      </div>
    )
    return (
      <div key="admin" className="app-view">
        <Suspense fallback={<AdminFallback />}>
          <AdminDashboard session={session} onLogout={handleLogout} onBack={() => setView('form')} />
        </Suspense>
      </div>
    )
  }

  return (
    <div key="form" className="app-view">
      <FormCatastro onAdminClick={() => setView('admin')} isAdmin={false} />
    </div>
  )
}
