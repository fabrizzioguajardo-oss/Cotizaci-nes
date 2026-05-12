// Cliente Supabase para Middleware y Route Handlers que manejan cookies via
// request/response (no via next/headers).
//
// IMPORTANTE: este archivo es Edge-safe. NO importa de 'next/headers' ni de
// otros módulos Node-only. Por eso vive separado de supabaseServer.ts.

import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
