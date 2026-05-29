-- Datos de cotización México (Extruidos) en el draft (Fase B1.1).
-- Antes vivían solo en sesión y se perdían al refrescar.
--   correo_cliente / telefono_cliente: contacto del cliente para el PDF.
--   forma_pago: contado | credito30 | credito60 | credito90.
--   anticipo: monto MXN del anticipo (default 0).
-- (El "precio anterior por rollo" vive en cada línea dentro de items JSONB.)

ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS correo_cliente TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS telefono_cliente TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS forma_pago TEXT NOT NULL DEFAULT 'contado';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS anticipo NUMERIC DEFAULT 0;
