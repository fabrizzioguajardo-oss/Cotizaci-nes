// Route handler de callback de Supabase Auth.
// Recibe el token del magic link, lo intercambia por sesión, y redirige al
// usuario al destino original (o /cotizador por default).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseMiddleware } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/cotizador';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Crear response provisional para que el cliente Supabase pueda setear cookies
  const response = NextResponse.redirect(`${origin}${next}`);
  const supabase = getSupabaseMiddleware(request, response);

  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=supabase_not_configured`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[auth/callback] exchange failed:', error);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return response;
}
