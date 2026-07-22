const DB_NAME    = 'catastro-offline-v1'
const DB_VERSION = 2          // v2: añade store 'sent'
const ST_QUEUE   = 'queue'
const ST_CNFLCT  = 'conflicts'
const ST_SENT    = 'sent'
const MAX_SENT   = 200

const cache = { queue: [], conflicts: [], sent: [], ready: false }
const readyListeners = []

let _dbPromise = null
let _idbFailed  = false

function openDB() {
  if (_idbFailed)  return Promise.reject(new Error('IndexedDB no disponible'))
  if (_dbPromise)  return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(ST_QUEUE))  db.createObjectStore(ST_QUEUE,  { keyPath: '_qid' })
      if (!db.objectStoreNames.contains(ST_CNFLCT)) db.createObjectStore(ST_CNFLCT, { keyPath: '_qid' })
      if (!db.objectStoreNames.contains(ST_SENT))   db.createObjectStore(ST_SENT,   { keyPath: '_folio' })
    }
    req.onerror = e => { _dbPromise = null; reject(e.target.error) }
    req.onsuccess = e => {
      const db = e.target.result
      const lsQueue     = _lsRead('catastro_offline_queue')
      const lsConflicts = _lsRead('catastro_conflicts')

      const tx = db.transaction([ST_QUEUE, ST_CNFLCT], 'readwrite')
      const qAll = tx.objectStore(ST_QUEUE).getAll()
      const cAll = tx.objectStore(ST_CNFLCT).getAll()

      tx.onerror = (e) => {
        console.error('[offlineQueue] read tx error:', e.target?.error)
        cache.ready = true
        readyListeners.forEach(cb => cb(cache))
        readyListeners.length = 0
        resolve(db)
      }
      tx.oncomplete = () => {
        const existingQ = qAll.result ?? []
        const existingC = cAll.result ?? []
        const migrateTx = db.transaction([ST_QUEUE, ST_CNFLCT], 'readwrite')
        const migrateQ  = migrateTx.objectStore(ST_QUEUE)
        const migrateC  = migrateTx.objectStore(ST_CNFLCT)

        if (existingQ.length === 0 && lsQueue.length > 0) {
          lsQueue.forEach(item => migrateQ.put(item))
          try { localStorage.removeItem('catastro_offline_queue') } catch { /* storage unavailable */ }
        }
        if (existingC.length === 0 && lsConflicts.length > 0) {
          lsConflicts.forEach(item => migrateC.put(item))
          try { localStorage.removeItem('catastro_conflicts') } catch { /* storage unavailable */ }
        }

        migrateTx.oncomplete = () => {
          const loadTx = db.transaction([ST_QUEUE, ST_CNFLCT, ST_SENT], 'readonly')
          const lQ = loadTx.objectStore(ST_QUEUE).getAll()
          const lC = loadTx.objectStore(ST_CNFLCT).getAll()
          const lS = loadTx.objectStore(ST_SENT).getAll()
          loadTx.onerror = (e) => {
            console.error('[offlineQueue] load tx error:', e.target?.error)
            cache.ready = true
            readyListeners.forEach(cb => cb(cache))
            readyListeners.length = 0
            resolve(db)
          }
          loadTx.oncomplete = () => {
            cache.queue     = lQ.result ?? []
            cache.conflicts = lC.result ?? []
            cache.sent      = (lS.result ?? []).sort((a, b) =>
              (b._sentAt ?? '').localeCompare(a._sentAt ?? ''))
            cache.ready     = true
            readyListeners.forEach(cb => cb(cache))
            readyListeners.length = 0
            resolve(db)
          }
        }
        migrateTx.onerror = (e) => {
          console.error('[offlineQueue] migration error:', e.target?.error)
          cache.ready = true
          readyListeners.forEach(cb => cb(cache))
          readyListeners.length = 0
          resolve(db)
        }
      }
    }
  })
  return _dbPromise
}

function _lsRead(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] }
}

function _txPut(db, store, item) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).put(item)
    req.onsuccess = res
    req.onerror = e => rej(e.target.error)
  })
}

function _txDelete(db, store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).delete(key)
    req.onsuccess = res
    req.onerror = e => rej(e.target.error)
  })
}

function _txClear(db, store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).clear()
    req.onsuccess = res
    req.onerror = e => rej(e.target.error)
  })
}

openDB().catch(() => {
  // IDB unavailable (Safari incognito, disabled storage, etc.)
  // Lock further retries and signal ready with empty caches.
  _idbFailed = true
  cache.ready = true
  readyListeners.forEach(cb => cb(cache))
  readyListeners.length = 0
})

/* ── Public API ─────────────────────────────────────────── */

export function onQueueReady(cb) {
  if (cache.ready) cb(cache)
  else readyListeners.push(cb)
}

export function getQueue()     { return [...cache.queue] }
export function queueSize()    { return cache.queue.length }
export function getConflicts() { return [...cache.conflicts] }
export function getSent()      { return [...cache.sent] }

export async function enqueue(record) {
  const db    = await openDB()
  const folio = `FOL-${String(record.manzana).padStart(3, '0')}-${Date.now().toString(36).slice(-4).toUpperCase()}`
  const item  = {
    ...record,
    _qid:     `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    _at:      new Date().toISOString(),
    _folio:   folio,
    _retries: 0,
    _status:  'pending',
  }
  await _txPut(db, ST_QUEUE, item)
  cache.queue = [...cache.queue, item]
  return item
}

export async function dequeue(qid) {
  const db = await openDB()
  await _txDelete(db, ST_QUEUE, qid)
  cache.queue = cache.queue.filter(r => r._qid !== qid)
}

/** Marca un ítem de la cola como fallido e incrementa el contador de reintentos. */
export async function markStuck(qid) {
  const db   = await openDB()
  const item = cache.queue.find(r => r._qid === qid)
  if (!item) return
  const updated = { ...item, _retries: (item._retries ?? 0) + 1, _status: 'error' }
  await _txPut(db, ST_QUEUE, updated)
  cache.queue = cache.queue.map(r => r._qid === qid ? updated : r)
}

/** Guarda un registro en el historial de enviados (máx 200). */
export async function addSent(item) {
  const db = await openDB()
  await _txPut(db, ST_SENT, item)
  cache.sent = [item, ...cache.sent.filter(r => r._folio !== item._folio)]
  if (cache.sent.length > MAX_SENT) {
    const overflow = cache.sent.slice(MAX_SENT)
    cache.sent = cache.sent.slice(0, MAX_SENT)
    await Promise.all(overflow.map(old => _txDelete(db, ST_SENT, old._folio).catch(() => {})))
  }
}

export async function addConflict(record) {
  const db   = await openDB()
  const item = { ...record, _conflictAt: new Date().toISOString() }
  await _txPut(db, ST_CNFLCT, item)
  cache.conflicts = [...cache.conflicts, item]
}

export async function clearConflicts() {
  const db = await openDB()
  await _txClear(db, ST_CNFLCT)
  cache.conflicts = []
}
