// Lista de emails que son admin. SSOT cliente — debe matchear la lógica del
// trigger SQL en supabase/migrations/002_auth_and_roles.sql.
//
// Para agregar un admin nuevo:
// 1. Agrega su email a esta lista
// 2. Actualiza la función handle_new_user en SQL (lo mismo)
// 3. Si el usuario ya existe, corre el backfill SQL

export const ADMIN_EMAILS = [
  'fabrizzio.guajardo@bionovapack.com',
  'diego.cortes@bionovapack.com',
  'diego@bionovapack.com',
] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase() as (typeof ADMIN_EMAILS)[number]);
}
