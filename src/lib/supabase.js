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

const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

export function getLocalSession() {
  const stored = localStorage.getItem(localSessionKey)
  if (!stored) return null
  try {
    const session = JSON.parse(stored)
    if (Date.now() - new Date(session.created_at).getTime() > SESSION_TTL_MS) {
      localStorage.removeItem(localSessionKey)
      return null
    }
    return session
  } catch { return null }
}

export function setLocalSession(email) {
  const session = { user: { email }, created_at: new Date().toISOString() }
  localStorage.setItem(localSessionKey, JSON.stringify(session))
  return session
}

export function clearLocalSession() {
  localStorage.removeItem(localSessionKey)
}
