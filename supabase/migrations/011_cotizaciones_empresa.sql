-- Empresa/mercado + transporte México del draft (v1.23, multi-empresa).
--
-- empresa: 'bionovapack' (USA, USD) | 'extruidos' (México, MXN).
-- transporte_mx: 'pickup' (recoge en almacén, $0) | 'castores' (envío MXN).
--   Solo aplica cuando empresa = 'extruidos'. El monto del flete Castores se
--   guarda en el trailer único (columna trailers, ya existente).

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS empresa TEXT NOT NULL DEFAULT 'bionovapack';

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS transporte_mx TEXT NOT NULL DEFAULT 'pickup';
