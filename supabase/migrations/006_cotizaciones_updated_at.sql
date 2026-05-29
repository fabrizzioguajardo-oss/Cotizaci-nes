-- Concurrencia optimista para el draft de cotización.
--
-- Motivación (bug del Adversario en la auditoría): un vendedor abre el
-- cotizador en dos pestañas (común al comparar dos clientes). Ambas cargan
-- el MISMO draft (hay un solo draft activo por usuario). Las dos editan y
-- autoguardan. Hoy la última escritura gana SILENCIOSAMENTE — la pestaña
-- que guardó primero pierde su trabajo sin enterarse.
--
-- Fix: cada draft tiene un `updated_at`. El cliente recuerda el valor que
-- vio la última vez. Al guardar, el servidor solo acepta el UPDATE si el
-- `updated_at` actual coincide con el que el cliente trae (optimistic lock).
-- Si otra pestaña ya guardó (y bumpeó updated_at), el UPDATE no matchea →
-- el endpoint responde 409 y la pestaña conflictiva avisa al usuario en
-- vez de pisar el trabajo de la otra.

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill: drafts existentes sin updated_at toman su created_at (o ahora).
UPDATE cotizaciones
  SET updated_at = COALESCE(updated_at, created_at, NOW())
  WHERE updated_at IS NULL;
