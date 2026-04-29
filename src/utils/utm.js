const a  = 6378137.0
const f  = 1 / 298.257223563
const b  = a * (1 - f)
const e2 = 2 * f - f * f
const ep2 = e2 / (1 - e2)
const k0 = 0.9996

export function toUTM(lat, lng) {
  const zone      = Math.floor((lng + 180) / 6) + 1
  const lonOrigin = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180
  const latR      = lat * Math.PI / 180
  const lngR      = lng * Math.PI / 180

  const N = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2)
  const T = Math.tan(latR) ** 2
  const C = ep2 * Math.cos(latR) ** 2
  const A = Math.cos(latR) * (lngR - lonOrigin)

  const M = a * (
    (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256)          * latR
    - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024)          * Math.sin(2*latR)
    + (15*e2**2/256 + 45*e2**3/1024)                  * Math.sin(4*latR)
    - (35*e2**3/3072)                                  * Math.sin(6*latR)
  )

  const easting = k0 * N * (
    A + (1 - T + C) * A**3 / 6
    + (5 - 18*T + T**2 + 72*C - 58*ep2) * A**5 / 120
  ) + 500000

  let northing = k0 * (
    M + N * Math.tan(latR) * (
      A**2 / 2
      + (5 - T + 9*C + 4*C**2)                     * A**4 / 24
      + (61 - 58*T + T**2 + 600*C - 330*ep2)        * A**6 / 720
    )
  )
  if (lat < 0) northing += 10000000

  return {
    zone,
    hemi:     lat >= 0 ? 'N' : 'S',
    easting:  Math.round(easting),
    northing: Math.round(northing),
    label:    `${zone}N  E ${Math.round(easting).toLocaleString()}  N ${Math.round(northing).toLocaleString()}`,
  }
}
