export const TIPOS_VIALIDAD = [
  { code: 'AVE', label: 'Avenida' },
  { code: 'BLV', label: 'Boulevard' },
  { code: 'CAL', label: 'Calle' },
  { code: 'CJN', label: 'Callejón' },
  { code: 'CDA', label: 'Cerrada' },
  { code: 'CZA', label: 'Calzada' },
  { code: 'CAR', label: 'Carretera' },
]

export const TIPO_LABELS = Object.fromEntries(TIPOS_VIALIDAD.map(t => [t.code, t.label]))

export const TIPOS_PAVIMENTO = [
  { code: 'AD', label: 'Adoquín' },
  { code: 'HI', label: 'Concreto Hidráulico' },
  { code: 'AS', label: 'Asfalto' },
  { code: 'EM', label: 'Empedrado' },
  { code: 'TE', label: 'Terracería' },
  { code: 'TI', label: 'Tierra' },
]

export const SERVICIOS_FULL = [
  { key: 'aguaPotable',       label: 'Agua Potable' },
  { key: 'drenaje',           label: 'Drenaje' },
  { key: 'alcantarillado',    label: 'Alcantarillado' },
  { key: 'electrificacion',   label: 'Electrificación' },
  { key: 'guarniciones',      label: 'Guarniciones' },
  { key: 'banquetas',         label: 'Banquetas' },
  { key: 'pavimento',         label: 'Pavimento',            hasTipo: true },
  { key: 'recoleccionBasura', label: 'Recolección de Basura' },
]

export const SERVICIOS_SHORT = SERVICIOS_FULL.map(s =>
  s.key === 'recoleccionBasura' ? { ...s, label: 'Basura' } : s
)

export const EQUIPAMIENTO_FULL = [
  { key: 'educacionCultura',  label: 'Educación y Cultura' },
  { key: 'transportePublico', label: 'Transporte Público' },
  { key: 'comercioAbasto',    label: 'Comercio y Abasto' },
  { key: 'recreacionDeporte', label: 'Recreación y Deporte' },
  { key: 'saludAsistencia',   label: 'Salud y Asistencia' },
  { key: 'telefono',          label: 'Teléfono' },
  { key: 'correosYTelegrafo', label: 'Correos y Telégrafo' },
  { key: 'contaminacion',     label: 'Contaminación' },
  { key: 'calleEspecial',     label: 'Calle Especial' },
]

export const EQUIPAMIENTO_SHORT = [
  { key: 'educacionCultura',  label: 'Educación' },
  { key: 'transportePublico', label: 'Transporte' },
  { key: 'comercioAbasto',    label: 'Comercio' },
  { key: 'recreacionDeporte', label: 'Deporte' },
  { key: 'saludAsistencia',   label: 'Salud' },
  { key: 'telefono',          label: 'Teléfono' },
  { key: 'correosYTelegrafo', label: 'Correos' },
  { key: 'contaminacion',     label: 'Contaminación' },
  { key: 'calleEspecial',     label: 'C. Especial' },
]

export const OPCIONES_SERVICIO = [
  { val: 'B', label: 'Bueno',   peso: 0.76, color: 'green' },
  { val: 'R', label: 'Regular', peso: 0.70, color: 'amber' },
  { val: 'M', label: 'Malo',    peso: 0.64, color: 'red'   },
  { val: 'N', label: 'Ninguno', peso: 1.00, color: 'muted' },
]

export const IMPORT_SERV_COLS  = ['AguaPotable','Drenaje','Alcantarillado','Electrificacion','Guarniciones','Banquetas','Pavimento','RecoleccionBasura']
export const IMPORT_EQUIP_COLS = ['EducacionCultura','TransportePublico','ComercioAbasto','RecreacionDeporte','SaludAsistencia','Telefono','CorreosYTelegrafo','Contaminacion','CalleEspecial']
export const IMPORT_PESOS      = Object.fromEntries(OPCIONES_SERVICIO.map(o => [o.val, o.peso]))
