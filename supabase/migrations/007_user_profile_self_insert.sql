-- Permitir que un usuario CREE su propia fila de perfil.
--
-- Motivación (bug crítico #3 de la revisión): el endpoint PATCH /api/profile
-- hacía UPDATE de user_profiles. Si la fila no existía (el trigger
-- handle_new_user falló, o cuenta anterior a la migración del trigger), el
-- UPDATE matcheaba 0 filas, no daba error, y el modal de onboarding entraba
-- en loop infinito: guardaba "ok" sin guardar nada, recargaba, name seguía
-- vacío, modal reaparecía. El vendedor quedaba encerrado sin poder cotizar.
--
-- Fix: el endpoint ahora hace upsert. Para que el INSERT del upsert pase RLS,
-- hace falta esta policy. El INSERT solo se permite para la propia fila
-- (auth.uid() = user_id); el endpoint server-side fuerza email = user.email y
-- nunca acepta role del cliente, así que un vendedor no puede crearse como admin.

DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
CREATE POLICY "users_insert_own_profile" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
