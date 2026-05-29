-- Snapshot inmutable de cada cotización emitida.
--
-- Motivación (de la auditoría con la Mesa Redonda): hoy, cuando un vendedor
-- genera el PDF al cliente o la PO a Extruidos, los datos solo viven en el
-- draft (que el vendedor puede modificar o borrar) y en el PDF descargado
-- (que vive afuera del sistema). Si dos semanas después el cliente reclama
-- "esto no es lo que me cotizaste", o si Diego sube precios EDSA nuevos,
-- no hay forma de reconstruir exactamente lo que se envió.
--
-- Esta tabla guarda un SNAPSHOT CONGELADO al momento de generar el PDF:
-- items, trailers, precios, TC, totales, warnings. Como JSONB.
--
-- INMUTABILIDAD: hay policies de SELECT e INSERT, pero NO de UPDATE ni
-- DELETE. Esto significa que ninguna fila puede modificarse o borrarse
-- vía cliente — solo se pueden agregar nuevas. Si hay un error tipográfico
-- en una cotización, se emite una nueva versión; la original queda como
-- registro histórico inalterable.
--
-- Además guardamos un SHA-256 del snapshot al momento de insert. Si alguien
-- con acceso directo a la base modifica el JSON, el hash deja de coincidir
-- y queda evidencia (puede auditarse vía script).

CREATE TABLE IF NOT EXISTS cotizaciones_emitidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  -- 'quote' = cotización al cliente (spec declarado).
  -- 'po'    = orden de compra a Extruidos (spec real).
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('quote', 'po')),
  numero VARCHAR(50) NOT NULL,
  cliente VARCHAR(255),
  contacto VARCHAR(255),
  direccion TEXT,
  vendedor VARCHAR(200) NOT NULL,
  tc NUMERIC(10, 4) NOT NULL,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Snapshot completo: { schemaVersion, items, trailers, quote (perItem,
  -- perTrailer, totals, warnings), meta }.
  snapshot JSONB NOT NULL,
  -- SHA-256 hex del snapshot serializado al momento del insert.
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

-- Vendedor ve solo las suyas; admin ve todas.
DROP POLICY IF EXISTS "users_select_own_emitidas" ON cotizaciones_emitidas;
CREATE POLICY "users_select_own_emitidas" ON cotizaciones_emitidas
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Solo el dueño puede insertar (con user_id = su propia uid).
DROP POLICY IF EXISTS "users_insert_own_emitidas" ON cotizaciones_emitidas;
CREATE POLICY "users_insert_own_emitidas" ON cotizaciones_emitidas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- INMUTABILIDAD: NO se crean policies de UPDATE ni DELETE. Sin policy
-- explícita, RLS rechaza ambas operaciones por default (table tiene RLS
-- enabled). Si alguna vez se necesita revocar/anular una cotización emitida,
-- se hace creando otra entrada con tipo='cancelacion' (no en este sprint).
