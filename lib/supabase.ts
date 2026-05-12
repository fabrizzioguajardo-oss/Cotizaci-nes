import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

// Cliente "legacy" singleton sin cookies (para scripts / API routes que no
// requieren sesión de usuario). Sigue funcionando para el catalog público.
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn('[supabase] env vars no configuradas - persistencia deshabilitada');
    }
    return null;
  }
  _client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  return _client;
}

// Cliente del BROWSER con cookies. Usar en componentes 'use client' que
// necesitan saber la sesión actual (login, logout, perfil del usuario).
let _browserClient: ReturnType<typeof createSSRBrowserClient> | null = null;
export function getSupabaseBrowser() {
  if (typeof window === 'undefined') return null;
  if (_browserClient) return _browserClient;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  _browserClient = createSSRBrowserClient(supabaseUrl, supabaseAnonKey);
  return _browserClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
