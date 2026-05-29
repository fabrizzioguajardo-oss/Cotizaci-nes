-- Backstop de integridad: un solo draft activo por usuario.
--
-- Motivación (bug #14 de la revisión): el endpoint podía crear un 2º draft
-- para el mismo usuario (el path de insert tras un lock fallido). El GET solo
-- devuelve el más reciente, así que el otro quedaba huérfano e invisible.
-- El fix principal es a nivel app (POST sin id ahora actualiza el draft
-- existente en vez de insertar). Este índice es la red de seguridad a nivel
-- BD contra un doble-insert por carrera concurrente.
--
-- Paso 1: limpiar duplicados existentes (de antes del fix), conservando el
-- draft MÁS RECIENTE por usuario. Los drafts son copias de trabajo
-- autoguardadas; el más reciente es el que el usuario ve (el GET ya usa
-- limit 1 order created_at desc), así que borrar los viejos es seguro.
DELETE FROM cotizaciones a
USING cotizaciones b
WHERE a.status = 'draft'
  AND b.status = 'draft'
  AND a.user_id = b.user_id
  AND (
    a.created_at < b.created_at
    OR (a.created_at = b.created_at AND a.id < b.id)
  );

-- Paso 2: el índice único parcial. Impide físicamente un 2º draft por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_draft_por_usuario
  ON cotizaciones (user_id)
  WHERE status = 'draft';
