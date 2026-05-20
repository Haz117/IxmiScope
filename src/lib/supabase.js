import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isConfigured = Boolean(url && key && !url.includes('tu-proyecto'))

async function fetchWithRetry(input, init, retries = 2) {
  try {
    const res = await fetch(input, init)
    if ((res.status === 429 || res.status === 503) && retries > 0) {
      await new Promise(r => setTimeout(r, 1000))
      return fetchWithRetry(input, init, retries - 1)
    }
    return res
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000))
      return fetchWithRetry(input, init, retries - 1)
    }
    throw err
  }
}

export const supabase = isConfigured
  ? createClient(url, key, { global: { fetch: fetchWithRetry } })
  : null

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
