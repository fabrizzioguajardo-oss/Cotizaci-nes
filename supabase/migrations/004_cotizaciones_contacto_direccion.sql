-- Persistir contacto + dirección del cliente como parte del draft de cotización.
--
-- Motivación: en v1.11 introdujimos los campos editables en el TopBar pero
-- solo vivían en state local — al refrescar la página se perdían.
-- Esta migración agrega las columnas a `cotizaciones` para que el draft
-- autosave (/api/cotizaciones/draft) las persista entre sesiones.
--
-- Usamos IF NOT EXISTS para que sea idempotente y segura de re-correr.

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS contacto VARCHAR(255);

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS direccion TEXT;
