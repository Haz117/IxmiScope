export function relativeTime(iso, { showTime = false } = {}) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  if (d > now) return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  const diffM = Math.floor((now - d) / 60000)
  const diffH = Math.floor(diffM / 60)
  const diffD = Math.floor(diffH / 24)
  if (diffM < 2) return 'Ahora'
  if (diffM < 60) return `Hace ${diffM} min`
  const hm = showTime ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : null
  if (diffH < 24) return showTime ? `Hoy ${hm}` : `Hace ${diffH}h`
  if (diffD === 1) return showTime ? `Ayer ${hm}` : 'Ayer'
  if (diffD < 7) return `Hace ${diffD} días`
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}
