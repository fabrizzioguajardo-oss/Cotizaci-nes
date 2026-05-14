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
    .select('id, cliente, tc, transport_usd, total_revenue_usd, total_cost_usd, utilidad_global, items, status, created_at')
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
  cliente: string;
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

  const row = {
    cliente: body.cliente || '(sin nombre)',
    tc: body.tc || 0,
    transport_usd: body.transport_usd || 0,
    total_revenue_usd: body.total_revenue_usd ?? 0,
    total_cost_usd: body.total_cost_usd ?? 0,
    utilidad_global: body.utilidad_global ?? null,
    items: body.items,
    status: 'draft' as const,
    user_id: user.id,
    vendedor: user.email ?? 'unknown',
  };

  if (body.id) {
    // Update existing draft
    const { data, error } = await sb
      .from('cotizaciones')
      .update(row)
      .eq('id', body.id)
      .eq('user_id', user.id) // RLS extra check
      .select('id')
      .maybeSingle();
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
    return NextResponse.json({ saved: true, id: data?.id ?? body.id });
  }

  // Insert nuevo draft
  const { data, error } = await sb
    .from('cotizaciones')
    .insert([row])
    .select('id')
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
  return NextResponse.json({ saved: true, id: data.id });
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
