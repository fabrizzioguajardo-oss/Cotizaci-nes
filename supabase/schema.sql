-- Schema SICE Cotizador - BioNovaPack
-- Ejecutar en Supabase SQL editor

-- Precios base de EDSA/Extruidos (los que Diego actualiza con su Excel)
CREATE TABLE IF NOT EXISTS precios_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_resina VARCHAR(20) NOT NULL,        -- 'virgen', 'reciclado', 'color'
  tipo_color VARCHAR(30),                  -- 'clear', 'orange', 'black', etc.
  ancho_in DECIMAL(6,2),
  calibre_ga DECIMAL(6,2),
  peso_neto_kg DECIMAL(8,4),
  cono_kg DECIMAL(6,4),
  precio_mxn_kg DECIMAL(10,4) NOT NULL,
  fecha_vigencia DATE NOT NULL,
  subido_por VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_precios_resina ON precios_base(tipo_resina);
CREATE INDEX IF NOT EXISTS idx_precios_fecha ON precios_base(fecha_vigencia DESC);

-- Cotizaciones guardadas
CREATE TABLE IF NOT EXISTS cotizaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente VARCHAR(200) NOT NULL,
  vendedor VARCHAR(100) DEFAULT 'Evers Lopez',
  fecha DATE DEFAULT CURRENT_DATE,
  tc DECIMAL(8,4) NOT NULL,
  transport_usd DECIMAL(10,2) NOT NULL,
  total_revenue_usd DECIMAL(12,2),
  total_cost_usd DECIMAL(12,2),
  utilidad_global DECIMAL(8,4),
  status VARCHAR(20) DEFAULT 'draft',      -- draft, sent, accepted, rejected
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente ON cotizaciones(cliente);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_status ON cotizaciones(status);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha ON cotizaciones(fecha DESC);

-- Catalogo centralizado de costos adicionales (master, intenso, aditivo,
-- caja blanca, banding, refilado, aumentos). Estos vienen de fuentes externas
-- (WhatsApp proveedor, correos, archivos sueltos) y aqui se centralizan.
CREATE TABLE IF NOT EXISTS cost_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category VARCHAR(20) NOT NULL,        -- 'master', 'intenso', 'aditivo', 'caja', 'banding', 'refilado', 'aumento'
  name VARCHAR(200) NOT NULL,           -- 'Orange', 'UV 12 month', 'Caja 80 cases 2.1kg', etc.
  precio_mxn_kg DECIMAL(10,4) NOT NULL, -- costo unitario final aplicable al producto
  inputs JSONB,                         -- inputs crudos del proveedor (ej: {caja_mxn: 4.87, kg_caja: 2.1, rollos: 80})
  source VARCHAR(50),                   -- 'whatsapp', 'email', 'excel', 'manual'
  source_note TEXT,                     -- mensaje literal o referencia (ej. "WhatsApp Diego 5 May 2026")
  vigente BOOLEAN DEFAULT TRUE,
  fecha_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  subido_por VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_category ON cost_catalog(category);
CREATE INDEX IF NOT EXISTS idx_catalog_vigente ON cost_catalog(vigente) WHERE vigente = TRUE;

ALTER TABLE cost_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_cost_catalog" ON cost_catalog FOR ALL USING (true) WITH CHECK (true);

-- Historial de cambios de precio (auditoría)
CREATE TABLE IF NOT EXISTS precios_historial (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_resina VARCHAR(20),
  precio_anterior DECIMAL(10,4),
  precio_nuevo DECIMAL(10,4),
  fecha_cambio DATE DEFAULT CURRENT_DATE,
  archivo_origen VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: dejar abierto para MVP, en prod habrá auth de usuarios
ALTER TABLE precios_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_precios_base" ON precios_base FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_cotizaciones" ON cotizaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_precios_historial" ON precios_historial FOR ALL USING (true) WITH CHECK (true);
