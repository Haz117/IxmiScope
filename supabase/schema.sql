-- ══════════════════════════════════════════════════════════
-- Schema completo — Ejecuta en Supabase → SQL Editor
-- (instalación nueva desde cero)
-- ══════════════════════════════════════════════════════════

-- Tabla de capturistas (usuarios de campo)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  nombre     TEXT    NOT NULL,
  email      TEXT    UNIQUE,
  municipio  TEXT,
  cargo      TEXT,
  activo     BOOLEAN DEFAULT TRUE
);

-- Tabla de registros catastro
CREATE TABLE IF NOT EXISTS public.registros (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  manzana               TEXT        NOT NULL UNIQUE,
  tipo_vialidad         TEXT        NOT NULL,
  nombre_vialidad       TEXT        NOT NULL,
  servicios             JSONB       NOT NULL DEFAULT '{}',
  tipo_pavimento        TEXT,
  equipamiento          JSONB       NOT NULL DEFAULT '{}',
  infra_mapa            JSONB       DEFAULT '[]',
  subtotal_servicios    NUMERIC(10,4) NOT NULL,
  subtotal_equipamiento INTEGER       NOT NULL,
  total                 NUMERIC(10,4) NOT NULL,
  observaciones         TEXT,
  capturista_id         UUID        REFERENCES public.usuarios(id)
);

-- Row Level Security
ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios  ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede insertar registros (capturistas de campo sin login)
CREATE POLICY "insertar_registros" ON public.registros
  FOR INSERT WITH CHECK (true);

-- Solo usuarios autenticados (admin) pueden leer
CREATE POLICY "leer_registros" ON public.registros
  FOR SELECT TO authenticated USING (true);

-- Solo admin gestiona capturistas
CREATE POLICY "gestionar_usuarios" ON public.usuarios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
