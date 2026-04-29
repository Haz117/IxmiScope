-- Ejecuta este script en Supabase → SQL Editor
-- Agrega columna de observaciones opcionales al formulario

ALTER TABLE public.registros
  ADD COLUMN IF NOT EXISTS observaciones TEXT;
