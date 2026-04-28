import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isConfigured = Boolean(url && key && !url.includes('tu-proyecto'))
export const supabase = isConfigured ? createClient(url, key) : null

// Local dev mock session
export const localSessionKey = 'catastro_admin_session'

export function getLocalSession() {
  const stored = localStorage.getItem(localSessionKey)
  return stored ? JSON.parse(stored) : null
}

export function setLocalSession(email) {
  const session = { user: { email }, created_at: new Date().toISOString() }
  localStorage.setItem(localSessionKey, JSON.stringify(session))
  return session
}

export function clearLocalSession() {
  localStorage.removeItem(localSessionKey)
}
