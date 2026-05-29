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
-- Seguridad: la policy permite UPDATE de la fila propia, pero el endpoint
-- /api/profile/route.ts es la única ruta autorizada — solo escribe el
-- campo `name`, jamás `role` ni `email`. Así un vendedor NO puede
-- auto-promoverse a admin aunque la policy diga "update on own row".

DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
