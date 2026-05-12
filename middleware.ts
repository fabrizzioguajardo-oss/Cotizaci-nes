// Middleware: refresca la sesión en cada request + protege rutas privadas.
// Rutas públicas: /login, /auth/*, api públicas explícitas.
// Todo lo demás requiere sesión activa.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseMiddleware } from '@/lib/supabaseServer';

const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/check-email'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = getSupabaseMiddleware(request, response);

  // Si Supabase no está configurado, dejamos pasar todo (modo dev local).
  if (!supabase) return response;

  // Esto refresca el token si expiró
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isApi = pathname.startsWith('/api/');
  const isStatic = pathname.startsWith('/_next/') || pathname.includes('.');

  // Si NO está logueado y la ruta es protegida → redirigir a /login
  if (!user && !isPublic && !isApi && !isStatic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Si está logueado y va a /login → mandar al cotizador
  if (user && pathname === '/login') {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/cotizador';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Aplicar a todas las rutas excepto archivos estáticos y favicon
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)',
  ],
};
