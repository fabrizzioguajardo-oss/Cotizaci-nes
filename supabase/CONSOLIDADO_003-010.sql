-- =============================================================================
-- SCRIPT CONSOLIDADO DE MIGRACIONES 003–010  (sesión mayo 2026, v1.12 → v1.21)
-- =============================================================================
-- Referencia única para re-aplicar TODO el esquema agregado en esta racha en un
-- entorno nuevo (staging, recuperación, etc.). Todas las sentencias son
-- IDEMPOTENTES (IF NOT EXISTS / DROP POLICY IF EXISTS), así que correr este
-- script sobre una base que ya las tiene es seguro y no duplica nada.
--
-- Estado a la fecha: Fabrizzio confirmó que las 003–010 ya están aplicadas en
-- producción. Este archivo es solo para tener una sola fuente de verdad.
--
-- Correr en: Supabase Dashboard → SQL Editor.
-- =============================================================================

-- ───── 003: el usuario puede ACTUALIZAR su propio perfil (nombre) ─────────────
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ───── 004: contacto + dirección del cliente en el draft ──────────────────────
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS contacto VARCHAR(255);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS direccion TEXT;

-- ───── 005: tabla inmutable de cotizaciones emitidas (historial) ──────────────
CREATE TABLE IF NOT EXISTS cotizaciones_emitidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('quote', 'po')),
  numero VARCHAR(50) NOT NULL,
  cliente VARCHAR(255),
  contacto VARCHAR(255),
  direccion TEXT,
  vendedor VARCHAR(200) NOT NULL,
  tc NUMERIC(10, 4) NOT NULL,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  snapshot JSONB NOT NULL,
  snapshot_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cot_emitidas_user_created
  ON cotizaciones_emitidas (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cot_emitidas_cliente
  ON cotizaciones_emitidas (cliente);
CREATE INDEX IF NOT EXISTS idx_cot_emitidas_numero
  ON cotizaciones_emitidas (numero);
ALTER TABLE cotizaciones_emitidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_select_own_emitidas" ON cotizaciones_emitidas;
CREATE POLICY "users_select_own_emitidas" ON cotizaciones_emitidas
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );
DROP POLICY IF EXISTS "users_insert_own_emitidas" ON cotizaciones_emitidas;
CREATE POLICY "users_insert_own_emitidas" ON cotizaciones_emitidas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- (No hay policies de UPDATE/DELETE: la tabla es inmutable por diseño.)

-- ───── 006: updated_at para concurrencia optimista del draft (multi-tab) ──────
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE cotizaciones
  SET updated_at = COALESCE(updated_at, created_at, NOW())
  WHERE updated_at IS NULL;

-- ───── 007: el usuario puede CREAR su propio perfil (upsert de nombre) ────────
DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
CREATE POLICY "users_insert_own_profile" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ───── 008: persistir el arreglo de trailers del draft ────────────────────────
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS trailers JSONB;

-- ───── 009: un solo draft activo por usuario (dedup + índice único) ───────────
DELETE FROM cotizaciones a
USING cotizaciones b
WHERE a.status = 'draft' AND b.status = 'draft'
  AND a.user_id = b.user_id
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));
CREATE UNIQUE INDEX IF NOT EXISTS uniq_draft_por_usuario
  ON cotizaciones (user_id) WHERE status = 'draft';

-- ───── 010: modo de cotización (directa / optimizada / optimizada_revision) ───
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS tipo_cotizacion TEXT NOT NULL DEFAULT 'directa';

-- =============================================================================
-- FIN. Las migraciones individuales (003–010) siguen en supabase/migrations/
-- como registro histórico; este consolidado es solo para re-aplicar de un jalón.
-- =============================================================================
