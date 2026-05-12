// Cliente Supabase para Server Components / Route Handlers que usan next/headers.
//
// IMPORTANTE: este archivo NO se puede importar desde middleware (Edge runtime).
// Para middleware usar `lib/supabaseMiddleware.ts` que es Edge-safe.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cliente para Server Components (page.tsx, layout.tsx en 'use server' context)
export async function getSupabaseServer() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component context — cookies son read-only desde aquí. Ignorar.
        }
      },
    },
  });
}
