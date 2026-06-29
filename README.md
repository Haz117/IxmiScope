# IxmiScope — Sistema de Catastro Digital

Aplicación web progresiva (PWA) para el levantamiento catastral del municipio de **Ixmiquilpan, Hidalgo**. Diseñada para equipos de campo que capturan, geolocaliza y sincronizan registros de infraestructura urbana, con panel de administración para supervisión, análisis y exportación.

---

## Características

### Formulario de campo
- Guiado por secciones con desbloqueo secuencial (manzana → servicios → equipamiento → mapa → observaciones) con scroll suave automático al desbloquear cada sección
- Geolocalización GPS automática con centrado del mapa al abrir
- **Detección de manzana duplicada** en tiempo real (debounce 600 ms) — muestra indicador ámbar inline y bloquea el avance; excluye registros borrados (soft-delete) para no bloquear manzanas válidamente re-capturadas
- **Borrador automático** — guarda el progreso en localStorage cada 2 s; si el usuario cierra y vuelve, se ofrece restaurar el borrador
- **Snackbar de deshacer** — tras cada envío aparece durante 5 s la opción de revertir el registro
- **Folio clickeable** — el folio del resumen de envío se puede tocar para copiarlo al portapapeles
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
- **Filtro de estadísticas por fecha** con selector de calendario personalizado (DatePicker React, sin picker nativo del navegador) y presets rápidos: Hoy, Últimos 7 días, Este mes
- **Estadísticas** — gráficas de barras, área y pastel con encabezados de sección y cuerpo diferenciados: calidad de servicios, equipamiento, distribución por tipo de vialidad, puntaje por manzana, top manzanas, registros por día
- **Alerta de manzanas sin infraestructura** — lista las manzanas que no tienen ningún punto de infra registrado en el mapa
- **Mapa** — tres vistas:
  - *Infraestructura*: clustering de puntos con "Ver detalle" desde el popup; exportación directa a GeoJSON y DXF AutoCAD desde la barra de filtros
  - *Puntaje*: marcadores circulares coloreados por rango (verde / morado / ámbar) + ranking ordenado con leyenda flotante, toca una fila para volar al punto
  - *Calor*: densidad de puntaje representada con círculos concéntricos de opacidad gradual por manzana
- Carga hasta **10,000 registros** (límite explícito a PostgREST para superar el tope de 1,000 por defecto)
- **Pinch-zoom táctil** en el mapa del admin — `touch-action: none` en el contenedor Leaflet para que los gestos de pellizco no sean interceptados por el scroll de la página
- Toggle Satélite / Mapa base en las tres vistas; búsqueda por manzana o vialidad con autocompletado
- Búsqueda de dirección abierta (Nominatim) con mensaje de error claro cuando no hay conexión; buscador en el sheet de manzanas capturadas
- Chips de manzana capturada abren el detalle del registro directamente al hacer clic
- **Registros** — tabla con búsqueda (debounce 300ms), filtro por rango de fechas con DatePicker personalizado, **selector de filas por página** (20 / 50 / 100), ordenamiento por columna, fechas relativas (Hoy / Ayer / Hace N días), **sticky headers** y **vista de tarjetas** alternativa
- **Selección múltiple** con checkboxes y barra de acciones en lote
- **Exportación agrupada** en dropdown: selección o todo el dataset, en CSV / Excel (.xlsx) / GeoJSON / DXF
- Edición completa de registros (servicios, equipamiento y observaciones)
- Eliminación con optimistic UI y rollback en error
- **Cédula catastral PDF** por registro — diseño institucional oficial: encabezado navy/dorado (`#1e3a5f`/`#c8a84b`), folio autonumérico, secciones numeradas I–VI, tablas de identificación, calificación, infraestructura, área de firmas y pie de página; impresión vía `createPortal` al `<body>` para compatibilidad total con Chrome (requiere "Gráficos de fondo" activado)
- **Reporte ejecutivo PDF** — documento institucional multipágina: indicadores generales, barra de avance municipal, distribución por nivel y tabla completa de registros; vista previa en pantalla antes de imprimir; el diálogo de impresión se abre manualmente con el botón "Imprimir"
- **Exportación XLSX multi-hoja** — libro de trabajo con tres hojas: *Resumen Municipal* (KPIs + distribución), *Registros* (datos completos con encabezados en español) e *Infraestructura* (puntos de mapa con coordenadas); columnas con ancho óptimo automático
- **Exportación CSV mejorada** — encabezados descriptivos en español, columna de nivel de infraestructura calculada, valores textuales para servicios, registros ordenados por manzana
- **Skeletons de carga** en lugar de texto plano durante la obtención de datos
- Actualización en tiempo real vía Supabase Realtime (INSERT, UPDATE, DELETE)
- Detección de sesión expirada con logout automático
- Banner de desconexión de websocket con botón de recarga
- **Tooltips de ayuda** en gráficas, columnas de tabla y controles del mapa
- **Animaciones de tab** al cambiar entre Estadísticas / Mapa / Registros

### Diseño y rendimiento
- **Dark mode** — toggle manual en la topbar del formulario y del admin; persiste entre sesiones; cubre todos los elementos del panel de administración (página, modales, tablas, gráficas, mapa, filtros, inputs, reporte ejecutivo)
- Diseño responsive optimizado para móvil (touch targets extendidos, scroll iOS suave, breakpoints hasta 340 px) y escritorio; botón de administrador siempre visible en la topbar del formulario con ocultamiento progresivo de elementos secundarios en pantallas pequeñas
- Sistema de **tokens CSS semánticos** (`--c-primary`, `--lt-amber`, `--bd-green`, etc.) — colores consistentes en ambos temas sin valores hardcoded
- Mapa con altura fluida (`clamp(220px, 50vh, 380px)`) — se adapta a pantallas pequeñas sin media queries manuales
- **Scroll shadow** en la tabla de registros del admin — indica visualmente cuando hay contenido fuera del viewport horizontal
- `React.memo` en `ServiceRow` y `EquipRow` con comparadores personalizados — evita re-renders de filas no modificadas al capturar
- **Scroll lock** en todos los modales (`document.body.overflow = 'hidden'`) — impide desplazamiento del fondo al abrir cualquier modal
- Tecla `Escape` cierra cualquier modal abierto en formulario y admin
- **Accesibilidad**: `aria-pressed` en botones de opción, `aria-busy` en verificación de manzana, `role=status aria-live=polite` en toasts

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
├── constants/
│   └── catastro.js        # Fuente única de verdad: tipos, servicios, equipamiento, pesos
├── utils/
│   ├── utm.js             # Conversión WGS84 → UTM Zona 14N
│   ├── offlineQueue.js    # Cola IndexedDB para modo offline
│   ├── relativeTime.js    # Formateo de fechas relativas (es-MX)
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
