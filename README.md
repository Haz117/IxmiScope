# Ixmiscope — Sistema de Catastro Digital

Aplicación web progresiva (PWA) para el levantamiento catastral del municipio de **Ixmiquilpan, Hidalgo**. Permite a equipos de campo capturar, geolocalizar y sincronizar registros de infraestructura urbana, con panel de administración para análisis y exportación.

---

## Características

- **Captura de campo** — formulario guiado con geolocalización GPS y marcado en mapa interactivo
- **Modo sin conexión** — los registros se guardan en cola local y se sincronizan automáticamente al recuperar señal
- **Coordenadas UTM** — conversión automática WGS84 → UTM Zona 14N para compatibilidad con cartografía oficial
- **Marcadores de referencia** — el mapa muestra puntos ya capturados para evitar duplicados y orientar al capturista
- **Panel de administración** con:
  - Gráficas interactivas (barras, área, pastel) por tipo de infraestructura, servicio y equipamiento
  - Mapa de avance territorial con cuadrícula de manzanas y barra de progreso
  - Tabla de registros con búsqueda, filtro por fecha y paginación
  - Edición de registros existentes
  - Reporte PDF por registro
  - Exportación **CSV**, **GeoJSON** (QGIS/ArcGIS) y **DXF** (AutoCAD AC1015)
- **PWA instalable** — funciona como app nativa en Android/iOS/PC, con caché de tiles OSM offline

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite 8 |
| Base de datos | Supabase (PostgreSQL + RLS + Auth) |
| Mapas | react-leaflet + OpenStreetMap |
| Gráficas | recharts |
| PWA / Offline | vite-plugin-pwa + Workbox |
| Coordenadas | Conversión WGS84 → UTM propia (`src/utils/utm.js`) |
| Cola offline | localStorage (`src/utils/offlineQueue.js`) |

---

## Estructura del proyecto

```
src/
├── components/
│   ├── FormCatastro.jsx   # Formulario de captura + mapa de campo
│   ├── AdminDashboard.jsx # Panel de administración completo
│   ├── AdminLogin.jsx     # Login de administrador
│   └── Icons.jsx          # Iconos SVG inline
├── utils/
│   ├── utm.js             # Conversión WGS84 → UTM
│   └── offlineQueue.js    # Cola localStorage para modo offline
├── lib/
│   └── supabase.js        # Cliente Supabase
└── App.jsx
supabase/
└── schema.sql             # Schema completo con RLS y GRANTs
```

---

## Configuración

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/gobiernoixmiquilpan-boop/Ixmiscope.git
cd Ixmiscope
npm install
```

### 2. Variables de entorno

Crear un archivo `.env` en la raíz (nunca se sube al repositorio):

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

### 3. Aplicar el schema en Supabase

Ejecutar `supabase/schema.sql` en el **SQL Editor** de tu proyecto Supabase. Este script crea las tablas `registros` y `usuarios`, configura RLS y otorga los permisos necesarios.

### 4. Crear usuario administrador

```sql
INSERT INTO public.usuarios (email, nombre, rol)
VALUES ('admin@ixmiquilpan.gob.mx', 'Administrador', 'admin');
```

El usuario debe existir también en **Supabase Auth** (Authentication → Users → Invite).

### 5. Levantar en desarrollo

```bash
npm run dev
```

### 6. Build de producción

```bash
npm run build
npm run preview
```

---

## Despliegue

La app genera archivos estáticos en `dist/`. Compatible con:

- [Vercel](https://vercel.com) — conectar el repo y hacer deploy con un clic
- [Netlify](https://netlify.com) — igual, directorio de publicación: `dist`
- Servidor propio con Nginx — servir el contenido de `dist/` apuntando todo a `index.html`

---

## Seguridad

- Las credenciales de Supabase se manejan **exclusivamente** via variables de entorno (`.env`)
- `.env` está en `.gitignore` — nunca se sube al repositorio
- Row Level Security (RLS) activo: usuarios anónimos solo pueden insertar; lectura y edición requieren autenticación
- El administrador accede con email + contraseña via Supabase Auth

---

## Municipio

**H. Ayuntamiento de Ixmiquilpan, Hidalgo**  
Dirección de Catastro Municipal
# IxmiScope
