import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

// Cliente singleton. Si no hay env vars devuelve null y la app sigue funcionando
// en modo "local-only" (sin persistencia). Esto permite probar la herramienta antes
// de configurar Supabase.
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined') {
      // Solo loguear una vez en el cliente
      // eslint-disable-next-line no-console
      console.warn('[supabase] env vars no configuradas - persistencia deshabilitada');
    }
    return null;
  }
  _client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
