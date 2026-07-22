-- ══════════════════════════════════════════════════════════
-- PARCHES DE SEGURIDAD — ejecutar en Supabase → SQL Editor
-- Aplica SOLO si ya tienes la columna deleted_at (add_soft_delete.sql aplicado)
-- ══════════════════════════════════════════════════════════

-- ── 1. Restricción de borrado anónimo ───────────────────────────────────────
-- PROBLEMA: cualquier anónimo podía borrar CUALQUIER registro de la BD.
-- FIX: solo se puede hacer soft-delete dentro de los 10 minutos de creación,
--       lo que permite el "undo" del capturista sin abrir un borrado masivo.
DROP POLICY IF EXISTS "anon_soft_delete_registros" ON public.registros;
CREATE POLICY "anon_soft_delete_registros" ON public.registros
  FOR UPDATE TO anon
  USING   (deleted_at IS NULL AND created_at > now() - interval '10 minutes')
  WITH CHECK (deleted_at IS NOT NULL);

-- ── 2. Validaciones en inserción anónima ────────────────────────────────────
-- PROBLEMA: WITH CHECK (true) aceptaba cualquier dato.
-- FIX: validamos rangos y tamaños.
-- Notas:
--   * tipo_vialidad usa códigos de 3 letras (AVE, BLV, CAL, CJN, CDA, CZA, CAR)
--   * subtotal_servicios max = 8 (8 servicios × peso 1.00)
--   * subtotal_equipamiento max = 9 (9 ítems binarios)
--   * total max real = 17
DROP POLICY IF EXISTS "anon_insert_registros" ON public.registros;
CREATE POLICY "anon_insert_registros" ON public.registros
  FOR INSERT TO anon
  WITH CHECK (
    manzana IS NOT NULL AND length(trim(manzana)) > 0
    AND tipo_vialidad IN ('AVE','BLV','CAL','CJN','CDA','CZA','CAR')
    AND length(nombre_vialidad) BETWEEN 1 AND 120
    AND subtotal_servicios    >= 0 AND subtotal_servicios    <= 10
    AND subtotal_equipamiento >= 0 AND subtotal_equipamiento <= 9
    AND total                 >= 0 AND total                 <= 20
    AND octet_length(servicios::text)    < 51200
    AND octet_length(equipamiento::text) < 51200
    AND octet_length(infra_mapa::text)   < 102400
  );

-- ── 3. CHECK constraints en la tabla (defensa en profundidad) ───────────────
-- ADD CONSTRAINT IF NOT EXISTS no existe en Postgres 15 (Supabase),
-- por eso usamos un bloque DO que verifica antes de agregar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_total_range' AND conrelid = 'public.registros'::regclass
  ) THEN
    ALTER TABLE public.registros
      ADD CONSTRAINT chk_total_range CHECK (total >= 0 AND total <= 20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_subtotales_range' AND conrelid = 'public.registros'::regclass
  ) THEN
    ALTER TABLE public.registros
      ADD CONSTRAINT chk_subtotales_range
        CHECK (subtotal_servicios >= 0 AND subtotal_servicios <= 10
           AND subtotal_equipamiento >= 0 AND subtotal_equipamiento <= 9);
  END IF;

  -- chk_nombre_length omitido: la validación de longitud ya está en la RLS policy
  -- (aplicar un CHECK a la tabla fallaría si hay registros existentes con nombres largos)

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_tipo_vialidad' AND conrelid = 'public.registros'::regclass
  ) THEN
    ALTER TABLE public.registros
      ADD CONSTRAINT chk_tipo_vialidad
        CHECK (tipo_vialidad IN ('AVE','BLV','CAL','CJN','CDA','CZA','CAR'));
  END IF;
END $$;
