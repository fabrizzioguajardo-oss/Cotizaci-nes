// Route handler de callback de Supabase Auth.
// Recibe el token del magic link, lo intercambia por sesión, y redirige al
// usuario al destino original (o /cotizador por default).
//
// PATRÓN OFICIAL Supabase + Next.js App Router con @supabase/ssr.
// Route handlers corren en Node runtime por default, así que sí podemos
// usar `cookies()` de `next/headers` (a diferencia del middleware que
// corre en Edge).

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/cotizador';

  if (!code) {
    // Supabase redirige aquí con error/error_description cuando el enlace
    // expiró, ya fue usado, o el flujo PKCE no cuadra. Propagar el motivo
    // real a /login para que el usuario vea QUÉ pasó en lugar de un loop
    // mudo que lo regresa a pedir el correo sin explicación.
    const errDesc = searchParams.get('error_description');
    const errCode = searchParams.get('error_code');
    const err = searchParams.get('error');
    const reason = errDesc || errCode || err || 'missing_code';
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/login?error=supabase_not_configured`);
  }

  // Usar cookies() de next/headers — patron oficial. Las cookies se setean
  // sobre el cookieStore y Next.js las incluye automáticamente en el response
  // del Route Handler, así no hay que manipular request/response manualmente.
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[auth/callback] no se pudieron setear cookies:', err);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[auth/callback] exchange failed:', error.message);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // Cookies de sesión ya están seteadas en cookieStore — el redirect
  // las incluye automáticamente.
  return NextResponse.redirect(`${origin}${next}`);
}
