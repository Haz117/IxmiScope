# IxmiScope — Sistema de Catastro Digital

Aplicación web progresiva (PWA) para el levantamiento catastral del municipio de **Ixmiquilpan, Hidalgo**. Diseñada para equipos de campo que capturan, geolocaliza y sincronizan registros de infraestructura urbana, con panel de administración para supervisión, análisis y exportación.

---

## Características

### Formulario de campo
- Guiado por secciones con desbloqueo secuencial (manzana → servicios → equipamiento → mapa → observaciones) con scroll suave automático al desbloquear cada sección
- Geolocalización GPS automática con centrado del mapa al abrir
- **Detección de manzana duplicada** en tiempo real (debounce 350ms) — muestra card con vialidad, puntaje y fecha del registro existente, con opción de editar directamente
- **Borrador automático** — guarda el progreso en localStorage cada 2 s; si el usuario cierra y vuelve, se ofrece restaurar el borrador
- **Snackbar de deshacer** — tras cada envío aparece durante 5 s la opción de revertir el registro
- **ScoreGauge** — medidor SVG del puntaje en tiempo real (visible para administradores)
- **Vista satélite** intercambiable con mapa base (Esri World Imagery)
- Marcadores de infraestructura con 4 tipos (Luminaria, Alcantarilla, Inmueble, Agua) y subtipos
- Coordenadas en **WGS84 y UTM Zona 14N** automáticas en cada punto
- Panel de manzanas capturadas en topbar — toca una para ver el detalle o cargar y editar
- Barra de progreso del formulario en tiempo real
- **Tooltips de ayuda** (ícono ?) en cada campo y sección con instrucciones y definiciones
- Iconos SVG en todos los botones y estados (sin emojis); spinners animados en acciones async

### Modo sin conexión
- Los registros se encolan en **IndexedDB** (migración automática desde localStorage) y se sincronizan al reconectarse
- **Barra de progreso de sincronización** con contador de pendientes y timestamp de última sincronización exitosa
- **Colapso de banners** — cuando hay 3 o más banners activos se agrupan en uno solo
- Las manzanas pendientes de sincronizar aparecen con badge "Offline" en el panel de progreso
- Detección de conflictos: si otra persona ya registró la misma manzana, avisa al capturista
- Banner de estado offline visible en topbar y en el admin

### Panel de administración
- **Filtro de estadísticas por fecha** con presets rápidos: Hoy, Últimos 7 días, Este mes
- **Estadísticas** — gráficas de barras, área y pastel: calidad de servicios, equipamiento, distribución por tipo de vialidad, puntaje por manzana, top manzanas, registros por día
- **Alerta de manzanas sin infraestructura** — lista las manzanas que no tienen ningún punto de infra registrado en el mapa
- **Mapa** — dos vistas:
  - *Infraestructura*: clustering de puntos con "Ver detalle" desde el popup
  - *Puntaje*: marcadores circulares coloreados por rango (verde / morado / ámbar) + ranking ordenado, toca una fila para volar al punto
- Vista satélite en ambas vistas del mapa
- Búsqueda por manzana o vialidad en el mapa; buscador en el sheet de manzanas capturadas
- Chips de manzana capturada abren el detalle del registro directamente al hacer clic
- **Registros** — tabla con búsqueda (debounce 300ms), filtro por rango de fechas, **selector de filas por página** (20 / 50 / 100), ordenamiento por columna, fechas relativas (Hoy / Ayer / Hace N días), **sticky headers** y **vista de tarjetas** alternativa
- **Selección múltiple** con checkboxes y barra de acciones en lote
- **Exportación agrupada** en dropdown: selección o todo el dataset, en CSV / Excel (.xlsx) / GeoJSON / DXF
- Edición completa de registros (servicios, equipamiento y observaciones)
- Eliminación con optimistic UI y rollback en error
- Reporte PDF por registro
- **Skeletons de carga** en lugar de texto plano durante la obtención de datos
- Actualización en tiempo real vía Supabase Realtime (INSERT, UPDATE, DELETE)
- Detección de sesión expirada con logout automático
- Banner de desconexión de websocket con botón de recarga
- **Tooltips de ayuda** en gráficas, columnas de tabla y controles del mapa
- **Animaciones de tab** al cambiar entre Estadísticas / Mapa / Registros

### Diseño
- **Dark mode automático** — se adapta a la preferencia del sistema operativo
- Diseño responsive optimizado para móvil (touch targets extendidos, scroll iOS suave, breakpoints hasta 360 px) y escritorio

### PWA
- Instalable en Android, iOS y PC (sin app store)
- Service worker con Workbox para caché de assets, tiles de mapa y API de Supabase

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite 8 |
| Base de datos | Supabase (PostgreSQL + RLS + Auth) |
| Mapas | react-leaflet + Leaflet.markercluster |
| Gráficas | Recharts |
| PWA / Offline | vite-plugin-pwa + Workbox |
| Coordenadas | Conversión WGS84 → UTM propia (`src/utils/utm.js`) |
| Cola offline | IndexedDB (`src/utils/offlineQueue.js`) |
| Exportación | xlsx, file-saver |

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
│   ├── utm.js             # Conversión WGS84 → UTM Zona 14N
│   ├── offlineQueue.js    # Cola IndexedDB para modo offline
│   └── recentHistory.js   # Historial reciente de capturas (máx 5)
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
git clone https://github.com/Haz117/IxmiScope.git
cd IxmiScope
npm install
```

### 2. Variables de entorno

Crear `.env` en la raíz (nunca se sube al repositorio):

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

### 3. Aplicar el schema en Supabase

Ejecutar `supabase/schema.sql` en el **SQL Editor** de tu proyecto Supabase. Crea la tabla `registros`, configura RLS y otorga los permisos necesarios.

### 4. Crear usuario administrador

Primero crear el usuario en **Supabase Auth** (Authentication → Users → Invite), luego:

```sql
INSERT INTO public.usuarios (email, nombre, rol)
VALUES ('admin@ixmiquilpan.gob.mx', 'Administrador', 'admin');
```

### 5. Desarrollo

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

Genera archivos estáticos en `dist/`. Compatible con:

- **Vercel** — conectar el repo, deploy automático en cada push
- **Netlify** — directorio de publicación: `dist`
- **Nginx** — servir `dist/` apuntando todo a `index.html`

---

## Seguridad

- Credenciales solo via variables de entorno, nunca en el código
- `.env` en `.gitignore`
- Row Level Security (RLS) activo: anónimos solo insertan; lectura y edición requieren autenticación
- Administrador accede con email + contraseña via Supabase Auth
- Sesiones expiradas detectadas automáticamente (401/PGRST301 → logout)

---

## H. Ayuntamiento de Ixmiquilpan, Hidalgo
Dirección de Catastro Municipal
