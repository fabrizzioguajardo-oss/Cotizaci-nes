// API del draft de cotización activa del usuario.
//
// GET    /api/cotizaciones/draft  → devuelve el draft más reciente del user
// POST   /api/cotizaciones/draft  → upsertea el draft (auto-save)
// DELETE /api/cotizaciones/draft  → borra el draft (botón "Nueva cotización")
//
// Por simplicidad, cada user tiene UN draft activo (status='draft'). Si quiere
// guardar como "enviada", lo cambia con un endpoint distinto futuro.
// Las cotizaciones enviadas se preservan separadamente para historial.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { LineItem } from '@/types';

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

// GET: último draft del usuario actual
export async function GET() {
  const sb = await getAuthedSupabase();
  if (!sb) return NextResponse.json({ draft: null });

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ draft: null }, { status: 401 });

  const { data, error } = await sb
    .from('cotizaciones')
    .select('id, cliente, contacto, direccion, tc, transport_usd, total_revenue_usd, total_cost_usd, utilidad_global, items, status, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}

// POST: upsertear el draft activo
interface UpsertBody {
  id?: string | null;
  // updated_at que el cliente vio por última vez. Sirve para concurrencia
  // optimista: si el draft en la BD tiene un updated_at más nuevo (otra
  // pestaña ya guardó), el endpoint responde 409 en vez de pisar.
  base_updated_at?: string | null;
  cliente: string;
  contacto?: string;
  direccion?: string;
  tc: number;
  transport_usd: number;
  total_revenue_usd?: number;
  total_cost_usd?: number;
  utilidad_global?: number | null;
  items: LineItem[];
}

export async function POST(req: NextRequest) {
  const sb = await getAuthedSupabase();
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 });

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  let body: UpsertBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Validación básica
  if (typeof body.cliente !== 'string' || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }

  // Timestamp de esta escritura. Lo seteamos explícitamente (en vez de
  // depender de un trigger) para devolvérselo al cliente y que lo use como
  // base del próximo optimistic check.
  const nowIso = new Date().toISOString();

  const row = {
    cliente: body.cliente || '(sin nombre)',
    contacto: body.contacto ?? null,
    direccion: body.direccion ?? null,
    tc: body.tc || 0,
    transport_usd: body.transport_usd || 0,
    total_revenue_usd: body.total_revenue_usd ?? 0,
    total_cost_usd: body.total_cost_usd ?? 0,
    utilidad_global: body.utilidad_global ?? null,
    items: body.items,
    status: 'draft' as const,
    user_id: user.id,
    vendedor: user.email ?? 'unknown',
    updated_at: nowIso,
  };

  if (body.id) {
    // Update existing draft con CONCURRENCIA OPTIMISTA.
    // Si el cliente trae base_updated_at, exigimos que coincida con el de
    // la BD. Si otra pestaña ya guardó (updated_at más nuevo), el filtro
    // .eq('updated_at', base) no matchea ninguna fila → devolvemos 409.
    let q = sb
      .from('cotizaciones')
      .update(row)
      .eq('id', body.id)
      .eq('user_id', user.id); // RLS extra check
    if (body.base_updated_at) {
      q = q.eq('updated_at', body.base_updated_at);
    }
    const { data, error } = await q.select('id, updated_at').maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[draft][update]', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        user_id: user.id,
        draft_id: body.id,
      });
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      }, { status: 500 });
    }

    // Sin fila actualizada: o el draft fue borrado, o (más común) otra
    // pestaña ya lo modificó y el optimistic check falló. Distinguimos
    // releyendo el draft actual.
    if (!data) {
      const { data: current } = await sb
        .from('cotizaciones')
        .select('id, updated_at')
        .eq('id', body.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (current) {
        // El draft existe pero con updated_at distinto → conflicto multi-tab.
        return NextResponse.json(
          {
            saved: false,
            conflict: true,
            error: 'El borrador cambió en otra pestaña o dispositivo.',
            server_updated_at: current.updated_at,
          },
          { status: 409 },
        );
      }
      // El draft ya no existe (borrado en otro lado) → caer a insert nuevo.
    } else {
      return NextResponse.json({ saved: true, id: data.id, updated_at: data.updated_at });
    }
  }

  // Insert nuevo draft
  const { data, error } = await sb
    .from('cotizaciones')
    .insert([row])
    .select('id, updated_at')
    .single();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[draft][insert]', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      user_id: user.id,
      cliente: row.cliente,
      tc: row.tc,
      transport_usd: row.transport_usd,
      items_count: Array.isArray(row.items) ? row.items.length : 'not array',
    });
    return NextResponse.json({
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    }, { status: 500 });
  }
  return NextResponse.json({ saved: true, id: data.id, updated_at: data.updated_at });
}

// DELETE: borra el draft activo del usuario
export async function DELETE() {
  const sb = await getAuthedSupabase();
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 });

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { error } = await sb
    .from('cotizaciones')
    .delete()
    .eq('user_id', user.id)
    .eq('status', 'draft');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
