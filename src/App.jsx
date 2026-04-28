import { useState, useEffect } from 'react'
import FormCatastro from './components/FormCatastro'
import AdminLogin from './components/AdminLogin'
import AdminDashboard from './components/AdminDashboard'
import { supabase, isConfigured, getLocalSession, clearLocalSession } from './lib/supabase'
import './App.css'

export default function App() {
  const [view, setView]       = useState('form') // 'form' | 'admin'
  const [session, setSession] = useState(() => getLocalSession())
  const [authReady, setAuthReady] = useState(!isConfigured)

  useEffect(() => {
    if (!isConfigured) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!authReady) return null

  async function handleLogout() {
    if (isConfigured) await supabase.auth.signOut()
    clearLocalSession()
    setSession(null)
    setView('form')
  }

  if (view === 'admin') {
    if (!session) return <AdminLogin onBack={() => setView('form')} onLoginLocal={(s) => { setSession(s); setView('admin') }} />
    return <AdminDashboard session={session} onLogout={handleLogout} />
  }

  return <FormCatastro onAdminClick={() => setView('admin')} isAdmin={false} />
}
