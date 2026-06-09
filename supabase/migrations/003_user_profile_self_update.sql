-- Permitir que cada usuario actualice SU PROPIO perfil.
--
-- Motivación: hasta v1.11 todos los PDFs salían firmados con el "user part"
-- del email (ej. "evers.lopez") porque no había forma de capturar el nombre
-- completo del vendedor en la app — magic link solo recibe email.
--
-- Esta migración habilita el flujo: el usuario edita su nombre desde el
-- cotizador (modal de onboarding al primer login + botón editar después)
-- y la API server-side hace UPDATE de user_profiles.name vía /api/profile.
--
-- ⚠️ SEGURIDAD — LEER 013_lock_role_column.sql:
-- Esta policy permite UPDATE de la fila propia. El comentario original asumía
-- que era seguro "porque solo /api/profile escribe `name`" — ESO ERA FALSO:
-- Postgres no tiene RLS por columna, y un vendedor puede saltarse /api/profile
-- y llamar a Supabase directo (anon key pública) para hacer
-- `update({ role: 'admin' })` sobre su propia fila. La migración 013 agrega un
-- trigger BEFORE UPDATE que bloquea cambios de `role` salvo por un admin; ESA
-- es la defensa real. No confiar en que "solo el endpoint escribe name".

DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
