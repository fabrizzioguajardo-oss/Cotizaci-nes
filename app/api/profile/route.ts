// PATCH /api/profile  { name: string }
// Actualiza SOLO el nombre del usuario actual en user_profiles. No expone
// role, email ni user_id — solo `name`. Esto evita que un vendedor pueda
// auto-promoverse a admin aunque la RLS policy permita UPDATE de la fila.
//
// Llamado desde:
//   - OnboardingNameModal (modal bloqueante al primer login si name está vacío)
//   - Botón "editar nombre" del TopBar (para cambios posteriores)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

async function getAuthedSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
        } catch {}
      },
    },
  });
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const rawName = (body as { name?: unknown })?.name;
  const name = typeof rawName === 'string' ? rawName.trim() : '';

  if (!name) {
    return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
  }
  if (name.length > 200) {
    return NextResponse.json({ error: 'El nombre no puede exceder 200 caracteres' }, { status: 400 });
  }

  const sb = await getAuthedSupabase();
  if (!sb) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 });
  }

  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Upsert por user_id: si la fila existe actualiza SOLO name; si no existe
  // (trigger handle_new_user falló, cuenta vieja) la crea. Esto evita el loop
  // infinito de onboarding donde un UPDATE sobre fila inexistente devolvía
  // "ok" sin guardar nada. email viene del server (user.email), nunca del
  // cliente, y role se omite → toma el default 'vendedor' en INSERT y se
  // preserva en UPDATE. Un vendedor no puede auto-promoverse a admin.
  // Requiere policies users_update_own_profile (003) y users_insert_own_profile (007).
  const { data, error } = await sb
    .from('user_profiles')
    .upsert(
      { user_id: user.id, email: user.email ?? '', name },
      { onConflict: 'user_id' },
    )
    .select('user_id, name')
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[/api/profile PATCH]', { user: user.email, code: error.code, msg: error.message });
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  // Defensa adicional: si por alguna razón no volvió fila, NO reportar éxito
  // (evita que el modal se cierre creyendo que guardó).
  if (!data) {
    return NextResponse.json(
      { error: 'No se pudo guardar el nombre. Contacta al admin.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, name: data.name ?? name });
}
