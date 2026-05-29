-- Persistir el arreglo de trailers del draft.
--
-- Motivación (bug crítico #5 de la revisión): el draft autosave nunca guardaba
-- el arreglo `trailers` (destino, kg_max, transport_usd por trailer). loadDraft
-- reconstruía siempre UN solo trailer id=1 con el flete agregado, pero los
-- items conservaban su trailerId 2/3. Resultado al recargar una cotización
-- multi-trailer (ej. Ohio + Monterrey): los items de trailers 2/3 quedaban
-- huérfanos (sin trailer contenedor → invisibles en el sidebar), su flete caía
-- a 0, y los destinos se borraban. Corrupción silenciosa.
--
-- Fix: guardar el arreglo completo de trailers como JSONB.

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS trailers JSONB;
