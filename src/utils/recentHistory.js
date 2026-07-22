const KEY = 'catastro_recent'
const MAX = 5

export function getRecent() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') }
  catch { return [] }
}

export function addRecent({ manzana, tipo_vialidad, nombre_vialidad, total }) {
  if (!manzana) return
  const prev = getRecent().filter(r => r?.manzana != null && r.manzana !== manzana)
  try {
    localStorage.setItem(KEY, JSON.stringify(
      [{ manzana, tipo_vialidad, nombre_vialidad, total, at: new Date().toISOString() }, ...prev].slice(0, MAX)
    ))
  } catch { /* storage full or unavailable */ }
}
