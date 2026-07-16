import { OPCIONES_SERVICIO, SERVICIOS_FULL, EQUIPAMIENTO_FULL } from '../constants/catastro'

export function getScoreLevel(total) {
  if (total >= 12) return 'ALTO'
  if (total >= 8)  return 'MEDIO'
  return 'BAJO'
}

export function getScoreLabel(total) {
  if (total >= 12) return 'Alto'
  if (total >= 8)  return 'Medio'
  return 'Bajo'
}

export function calcSubtotals(servicios, equipamiento) {
  const subtotal_servicios = SERVICIOS_FULL.reduce((s, item) => {
    const v = servicios[item.key]
    return v ? s + (OPCIONES_SERVICIO.find(o => o.val === v)?.peso ?? 0) : s
  }, 0)
  const subtotal_equipamiento = EQUIPAMIENTO_FULL.reduce((s, item) => {
    return s + Number(equipamiento[item.key] ?? 0)
  }, 0)
  return { subtotal_servicios, subtotal_equipamiento, total: subtotal_servicios + subtotal_equipamiento }
}
