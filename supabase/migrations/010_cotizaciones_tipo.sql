-- Modo de cotización del draft (v1.21).
--
-- 'directa'              → se fabrica tal cual el cliente pidió.
-- 'optimizada'           → el sistema propone una alternativa más rentable.
-- 'optimizada_revision'  → optimizada, pero un cambio de spec crítica (hoy:
--                          reducción de largo > 35%) requiere aprobación.
--
-- Se persiste para que el modo sobreviva refresh/reaperturas del draft.

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS tipo_cotizacion TEXT NOT NULL DEFAULT 'directa';
