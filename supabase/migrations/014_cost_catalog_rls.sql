-- 014_cost_catalog_rls.sql
-- M9 (auditoría): el catálogo de costos (adders centralizados de Diego) se
-- guardaba en localStorage POR DISPOSITIVO en vez de Supabase, porque
-- /api/catalog usaba el cliente anónimo y la RLS de cost_catalog devolvía 0
-- filas. La ruta ya se cambió a cliente autenticado (cookies); esta migración
-- agrega la policy de LECTURA para usuarios autenticados (la escritura sigue
-- siendo solo admin).
--
-- Idempotente: se puede correr más de una vez. Si ya existe admin_write_cost_catalog
-- (migración 002) no se duplica — se re-crea con DROP IF EXISTS.

ALTER TABLE cost_catalog ENABLE ROW LEVEL SECURITY;

-- Quitar la policy pública vieja si quedó de schema.sql.
DROP POLICY IF EXISTS "allow_all_cost_catalog" ON cost_catalog;

-- LECTURA: cualquier usuario autenticado puede leer el catálogo (los vendedores
-- lo consultan para elegir adders al cotizar).
DROP POLICY IF EXISTS "auth_read_cost_catalog" ON cost_catalog;
CREATE POLICY "auth_read_cost_catalog" ON cost_catalog
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ESCRITURA: solo admin (Diego/Fabrizzio) puede crear/actualizar/borrar.
DROP POLICY IF EXISTS "admin_write_cost_catalog" ON cost_catalog;
CREATE POLICY "admin_write_cost_catalog" ON cost_catalog
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );
