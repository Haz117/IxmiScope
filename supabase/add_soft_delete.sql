-- Soft-delete: agrega columna deleted_at a registros
-- Ejecuta en Supabase → SQL Editor

ALTER TABLE public.registros
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Capturistas anónimos pueden marcar su propio registro como eliminado (undo de envío)
-- USING: solo pueden afectar registros que NO están eliminados
-- WITH CHECK: solo pueden setear deleted_at a un valor no-nulo
DROP POLICY IF EXISTS "anon_soft_delete_registros" ON public.registros;
CREATE POLICY "anon_soft_delete_registros" ON public.registros
  FOR UPDATE TO anon
  USING   (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NOT NULL);
