const KEY = 'catastro_offline_queue'

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') }
  catch { return [] }
}

export function enqueue(record) {
  const queue = getQueue()
  const item  = { ...record, _qid: Date.now(), _at: new Date().toISOString() }
  localStorage.setItem(KEY, JSON.stringify([...queue, item]))
  return item._qid
}

export function dequeue(qid) {
  const updated = getQueue().filter(r => r._qid !== qid)
  localStorage.setItem(KEY, JSON.stringify(updated))
}

export function queueSize() {
  return getQueue().length
}
