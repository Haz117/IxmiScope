const DB_NAME    = 'catastro-offline-v1'
const DB_VERSION = 1
const ST_QUEUE   = 'queue'
const ST_CNFLCT  = 'conflicts'

// In-memory cache — provides synchronous reads (getQueue, queueSize, getConflicts)
const cache = { queue: [], conflicts: [], ready: false }
const readyListeners = []

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(ST_QUEUE))  db.createObjectStore(ST_QUEUE,  { keyPath: '_qid' })
      if (!db.objectStoreNames.contains(ST_CNFLCT)) db.createObjectStore(ST_CNFLCT, { keyPath: '_qid' })
    }
    req.onerror = e => { _dbPromise = null; reject(e.target.error) }
    req.onsuccess = e => {
      const db = e.target.result
      // Migrate from localStorage if IDB is empty
      const lsQueue     = _lsRead('catastro_offline_queue')
      const lsConflicts = _lsRead('catastro_conflicts')

      const tx = db.transaction([ST_QUEUE, ST_CNFLCT], 'readwrite')
      const qAll = tx.objectStore(ST_QUEUE).getAll()
      const cAll = tx.objectStore(ST_CNFLCT).getAll()

      tx.oncomplete = () => {
        const existingQ = qAll.result ?? []
        const existingC = cAll.result ?? []
        const migrateTx = db.transaction([ST_QUEUE, ST_CNFLCT], 'readwrite')
        const migrateQ  = migrateTx.objectStore(ST_QUEUE)
        const migrateC  = migrateTx.objectStore(ST_CNFLCT)

        if (existingQ.length === 0 && lsQueue.length > 0) {
          lsQueue.forEach(item => migrateQ.put(item))
          try { localStorage.removeItem('catastro_offline_queue') } catch {}
        }
        if (existingC.length === 0 && lsConflicts.length > 0) {
          lsConflicts.forEach(item => migrateC.put(item))
          try { localStorage.removeItem('catastro_conflicts') } catch {}
        }

        migrateTx.oncomplete = () => {
          // Final load into cache
          const loadTx = db.transaction([ST_QUEUE, ST_CNFLCT], 'readonly')
          const lQ = loadTx.objectStore(ST_QUEUE).getAll()
          const lC = loadTx.objectStore(ST_CNFLCT).getAll()
          loadTx.oncomplete = () => {
            cache.queue     = lQ.result ?? []
            cache.conflicts = lC.result ?? []
            cache.ready     = true
            readyListeners.forEach(cb => cb(cache))
            readyListeners.length = 0
            resolve(db)
          }
        }
        migrateTx.onerror = () => resolve(db)
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

// Initialize on module load (non-blocking)
openDB().catch(() => {})

/* ── Public API ─────────────────────────────────────────── */

/** Called once the IndexedDB cache is loaded. Fires immediately if already ready. */
export function onQueueReady(cb) {
  if (cache.ready) cb(cache)
  else readyListeners.push(cb)
}

// Synchronous reads (from in-memory cache)
export function getQueue()     { return [...cache.queue] }
export function queueSize()    { return cache.queue.length }
export function getConflicts() { return [...cache.conflicts] }

// Async writes
export async function enqueue(record) {
  const db   = await openDB()
  const item = { ...record, _qid: Date.now(), _at: new Date().toISOString() }
  await _txPut(db, ST_QUEUE, item)
  cache.queue = [...cache.queue, item]
  return item._qid
}

export async function dequeue(qid) {
  const db = await openDB()
  await _txDelete(db, ST_QUEUE, qid)
  cache.queue = cache.queue.filter(r => r._qid !== qid)
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
