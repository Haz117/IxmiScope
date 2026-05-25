-- ══════════════════════════════════════════════════════════
-- EJECUTA EN Supabase → SQL Editor
-- Agrega coordenadas GPS por manzana (capturadas automáticamente
-- desde el GPS del dispositivo al abrir el mapa en el formulario)
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.registros
  ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);
