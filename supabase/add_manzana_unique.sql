-- Ejecuta esto en Supabase → SQL Editor si ya creaste la tabla con schema.sql
-- Agrega restricción de unicidad sobre manzana

ALTER TABLE public.registros
  ADD CONSTRAINT registros_manzana_unique UNIQUE (manzana);
