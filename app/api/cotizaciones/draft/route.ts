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
import type { LineItem, Trailer } from '@/types';
import { getSupabaseServer as getAuthedSupabase } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

// GET: último draft del usuario actual
export async function GET() {
  const sb = await getAuthedSupabase();
  if (!sb) return NextResponse.json({ draft: null });

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ draft: null }, { status: 401 });

  const { data, error } = await sb
    .from('cotizaciones')
    .select('id, cliente, contacto, direccion, tipo_cotizacion, empresa, transporte_mx, correo_cliente, telefono_cliente, forma_pago, anticipo, tc, transport_usd, total_revenue_usd, total_cost_usd, utilidad_global, items, trailers, status, created_at, updated_at')
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
  tipo_cotizacion?: string;
  empresa?: string;
  transporte_mx?: string;
  correo_cliente?: string;
  telefono_cliente?: string;
  forma_pago?: string;
  anticipo?: number;
  tc: number;
  transport_usd: number;
  total_revenue_usd?: number;
  total_cost_usd?: number;
  utilidad_global?: number | null;
  items: LineItem[];
  trailers?: Trailer[];
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
    tipo_cotizacion: body.tipo_cotizacion ?? 'directa',
    empresa: body.empresa ?? 'bionovapack',
    transporte_mx: body.transporte_mx ?? 'pickup',
    correo_cliente: body.correo_cliente ?? null,
    telefono_cliente: body.telefono_cliente ?? null,
    forma_pago: body.forma_pago ?? 'contado',
    anticipo: body.anticipo ?? 0,
    tc: body.tc || 0,
    transport_usd: body.transport_usd || 0,
    total_revenue_usd: body.total_revenue_usd ?? 0,
    total_cost_usd: body.total_cost_usd ?? 0,
    utilidad_global: body.utilidad_global ?? null,
    items: body.items,
    trailers: body.trailers ?? null,
    status: 'draft' as const,
    user_id: user.id,
    vendedor: user.email ?? 'unknown',
    updated_at: nowIso,
  };

  // Respuesta de conflicto reutilizable (otra pestaña/dispositivo modificó
  // el mismo draft). El cliente entra en modo "recargar".
  const conflictResponse = (serverUpdatedAt: string | null) =>
    NextResponse.json(
      {
        saved: false,
        conflict: true,
        error: 'El borrador cambió en otra pestaña o dispositivo.',
        server_updated_at: serverUpdatedAt,
      },
      { status: 409 },
    );

  if (body.id) {
    // === CLIENTE CONOCE UN DRAFT (tiene id) → concurrencia optimista estricta ===
    if (!body.base_updated_at) {
      // id SIN base = el cliente perdió su ancla de versión (post-conflicto,
      // o estado inconsistente). NO hacemos blind overwrite: si el draft
      // existe, forzamos recarga; si ya no existe, cae a insert nuevo. Esto
      // cierra el hueco donde un save sin base pisaba el trabajo de otra
      // pestaña aunque el candado "estuviera activo".
      const { data: current } = await sb
        .from('cotizaciones')
        .select('id, updated_at')
        .eq('id', body.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (current) return conflictResponse(current.updated_at);
      // no existe → cae a insert
    } else {
      const { data, error } = await sb
        .from('cotizaciones')
        .update(row)
        .eq('id', body.id)
        .eq('user_id', user.id)            // RLS extra check
        .eq('updated_at', body.base_updated_at) // optimistic lock
        .select('id, updated_at')
        .maybeSingle();

      if (error) {
        // eslint-disable-next-line no-console
        console.error('[draft][update]', {
          code: error.code, message: error.message,
          details: error.details, hint: error.hint,
          user_id: user.id, draft_id: body.id,
        });
        return NextResponse.json({
          error: error.message, code: error.code,
          details: error.details, hint: error.hint,
        }, { status: 500 });
      }

      if (data) {
        return NextResponse.json({ saved: true, id: data.id, updated_at: data.updated_at });
      }
      // Sin fila: ¿borrado o conflicto? Releer para distinguir.
      const { data: current } = await sb
        .from('cotizaciones')
        .select('id, updated_at')
        .eq('id', body.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (current) return conflictResponse(current.updated_at);
      // no existe → cae a insert nuevo
    }
  } else {
    // === CLIENTE NO CONOCE NINGÚN DRAFT (sin id) → dedup ===
    // Antes esto siempre INSERTABA, pudiendo crear un 2º draft para el mismo
    // usuario (el GET solo devuelve el más reciente → el otro quedaba
    // huérfano e invisible). Ahora buscamos el draft existente y lo
    // actualizamos: un draft activo por usuario. Sin optimistic check porque
    // el cliente no cargó ese draft — su contenido actual es el autoritativo.
    const { data: existing } = await sb
      .from('cotizaciones')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { data, error } = await sb
        .from('cotizaciones')
        .update(row)
        .eq('id', existing.id)
        .eq('user_id', user.id)
        .select('id, updated_at')
        .maybeSingle();
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[draft][dedup-update]', { code: error.code, message: error.message, user_id: user.id });
        return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
      }
      if (data) {
        return NextResponse.json({ saved: true, id: data.id, updated_at: data.updated_at });
      }
      // si desapareció entre el select y el update, cae a insert
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
