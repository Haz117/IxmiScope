-- ══════════════════════════════════════════════════════════
-- EJECUTA ESTE SCRIPT EN Supabase → SQL Editor
-- Agrega las columnas que le faltan a la tabla registros
-- Es seguro correrlo aunque ya existan (usa IF NOT EXISTS)
-- ══════════════════════════════════════════════════════════

-- Mapa de infraestructura (marcadores colocados en el mapa)
ALTER TABLE public.registros
  ADD COLUMN IF NOT EXISTS infra_mapa JSONB DEFAULT '[]';

-- Observaciones opcionales al final del formulario
ALTER TABLE public.registros
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- Restricción de unicidad en manzana (por si no se aplicó antes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'registros_manzana_unique'
  ) THEN
    ALTER TABLE public.registros
      ADD CONSTRAINT registros_manzana_unique UNIQUE (manzana);
  END IF;
END$$;
