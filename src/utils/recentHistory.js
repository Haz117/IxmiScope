const KEY = 'catastro_recent'
const MAX = 5

export function getRecent() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') }
  catch { return [] }
}

export function addRecent({ manzana, tipo_vialidad, nombre_vialidad, total }) {
  const prev = getRecent().filter(r => r.manzana !== manzana)
  localStorage.setItem(KEY, JSON.stringify(
    [{ manzana, tipo_vialidad, nombre_vialidad, total, at: new Date().toISOString() }, ...prev].slice(0, MAX)
  ))
}
