-- v1.02 — autenticación con magic link + roles + RLS por usuario
-- Ejecutar en Supabase SQL Editor

-- 1) Tabla de perfiles con rol (admin / vendedor)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(200),
  role VARCHAR(20) NOT NULL DEFAULT 'vendedor',  -- 'admin' | 'vendedor'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_profiles_role_check CHECK (role IN ('admin', 'vendedor'))
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- 2) Trigger: cuando un usuario hace signup, se crea su perfil automáticamente.
-- Los emails en la lista de admins (Fabrizzio + Diego) reciben rol 'admin'.
-- El resto entra como 'vendedor'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE
      WHEN LOWER(NEW.email) IN (
        'fabrizzio.guajardo@bionovapack.com',
        'diego.cortes@bionovapack.com',
        'diego@bionovapack.com'
      ) THEN 'admin'
      ELSE 'vendedor'
    END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) RLS en user_profiles: cualquier usuario auth ve su propio perfil
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_see_own_profile" ON user_profiles;
CREATE POLICY "users_see_own_profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_see_all_profiles" ON user_profiles;
CREATE POLICY "admins_see_all_profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'admin')
  );

-- 4) Agregar user_id a cotizaciones + RLS de aislamiento
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_user ON cotizaciones(user_id);

-- Borrar policy abierta de la migración anterior
DROP POLICY IF EXISTS "allow_all_cotizaciones" ON cotizaciones;

-- Vendedor: solo ve y modifica sus propias cotizaciones
CREATE POLICY "users_select_own_cotizaciones" ON cotizaciones
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "users_insert_own_cotizaciones" ON cotizaciones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_cotizaciones" ON cotizaciones
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "users_delete_own_cotizaciones" ON cotizaciones
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 5) RLS en tablas de admin: solo admins escriben, todos los logged-in leen
-- (precios_base, cost_catalog, price_data_files, precios_historial)

-- precios_base
DROP POLICY IF EXISTS "allow_all_precios_base" ON precios_base;
CREATE POLICY "auth_read_precios_base" ON precios_base
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_write_precios_base" ON precios_base
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- cost_catalog
DROP POLICY IF EXISTS "allow_all_cost_catalog" ON cost_catalog;
CREATE POLICY "auth_read_cost_catalog" ON cost_catalog
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_write_cost_catalog" ON cost_catalog
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- price_data_files
DROP POLICY IF EXISTS "allow_all_price_data_files" ON price_data_files;
CREATE POLICY "auth_read_price_data_files" ON price_data_files
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_write_price_data_files" ON price_data_files
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- precios_historial
DROP POLICY IF EXISTS "allow_all_precios_historial" ON precios_historial;
CREATE POLICY "auth_read_precios_historial" ON precios_historial
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_write_precios_historial" ON precios_historial
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );
