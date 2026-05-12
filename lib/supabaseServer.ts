// Cliente Supabase para Server Components / Route Handlers / Middleware.
// Maneja cookies para refrescar la sesión automáticamente.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

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

// Cliente para Middleware — necesita request y response para manipular cookies.
export function getSupabaseMiddleware(request: NextRequest, response: NextResponse) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
