-- 013_lock_role_column.sql
-- CRÍTICO de seguridad (auditoría re-trace, hallazgo C1).
--
-- La policy `users_update_own_profile` (003) permite que un usuario actualice
-- SU propia fila de user_profiles. El comentario de 003 ASUMÍA que eso era
-- seguro "porque solo /api/profile escribe el campo name" — FALSO: Postgres no
-- tiene RLS a nivel de columna, así que un vendedor, usando la anon key pública
-- (va embebida en el bundle del navegador), puede saltarse /api/profile y hacer
-- directo desde la consola:
--     supabase.from('user_profiles').update({ role: 'admin' }).eq('user_id', <su uid>)
-- Eso pasa el WITH CHECK (sigue siendo su fila) y lo vuelve admin a nivel BD,
-- ganando todas las policies admin_write_* (precios_base, cost_catalog,
-- price_data_files, precios_historial) — control total de los precios
-- ultra-confidenciales que toda la app está diseñada para proteger.
--
-- Este trigger BEFORE UPDATE rechaza cualquier cambio de `role` salvo que el
-- ejecutor YA sea admin. (Un SELECT dentro de un trigger NO causa la recursión
-- 42P17 de las RLS policies; eso solo aplica a policies que se referencian a sí
-- mismas. SECURITY DEFINER hace que el chequeo lea el role real sin RLS.)

CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo nos importa cuando el role cambia.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- ¿El usuario autenticado que ejecuta el UPDATE ya es admin?
    IF NOT EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'No autorizado: solo un admin puede cambiar el rol.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON user_profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_self_escalation();

-- Nota: este trigger NO afecta el INSERT del trigger handle_new_user (002), que
-- crea el perfil inicial; solo intercepta UPDATEs. Tampoco bloquea que /api/profile
-- siga escribiendo `name` (NEW.role == OLD.role en ese flujo). Un admin legítimo
-- promoviendo a otro usuario pasa el chequeo (él ya es admin).
