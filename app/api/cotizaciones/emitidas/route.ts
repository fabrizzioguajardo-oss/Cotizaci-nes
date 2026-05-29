// POST /api/cotizaciones/emitidas
//   Guarda un snapshot inmutable de una cotización emitida (PDF generado).
//   Body: { tipo: 'quote'|'po', numero, snapshot }
//
// GET /api/cotizaciones/emitidas
//   Lista las cotizaciones emitidas del usuario actual (admin ve todas).
//   Solo metadata por default (cliente, número, fecha, vendedor). Para
//   ver el snapshot completo pasar ?id=UUID.
//
// La tabla cotizaciones_emitidas tiene RLS sin policies de UPDATE/DELETE
// — el snapshot es inmutable una vez insertado. Cualquier corrección
// requiere emitir una nueva cotización con número nuevo.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { hashSnapshot, type Snapshot } from '@/lib/snapshotEmitida';
import { computeQuote } from '@/lib/computeQuote';

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

interface PostBody {
  tipo: 'quote' | 'po';
  numero: string;
  snapshot: Snapshot;
}

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  // Validaciones básicas
  if (body.tipo !== 'quote' && body.tipo !== 'po') {
    return NextResponse.json({ error: 'tipo debe ser quote|po' }, { status: 400 });
  }
  if (typeof body.numero !== 'string' || !body.numero.trim()) {
    return NextResponse.json({ error: 'numero requerido' }, { status: 400 });
  }
  if (!body.snapshot || typeof body.snapshot !== 'object') {
    return NextResponse.json({ error: 'snapshot requerido' }, { status: 400 });
  }
  if (typeof body.snapshot.schemaVersion !== 'number') {
    return NextResponse.json({ error: 'snapshot.schemaVersion requerido' }, { status: 400 });
  }

  const sb = await getAuthedSupabase();
  if (!sb) return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 });

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  if (!body.snapshot.meta || typeof body.snapshot.meta !== 'object') {
    return NextResponse.json({ error: 'snapshot.meta requerido' }, { status: 400 });
  }

  // RECÁLCULO AUTORITATIVO DEL SERVIDOR.
  // Antes el snapshot guardaba `quote` (totales, costos, márgenes, warnings)
  // tal como lo mandó el cliente, y el hash solo certificaba "lo que el
  // cliente envió". Un navegador modificado podía persistir cifras falsas con
  // un hash válido — envenenando el registro que se vende como fuente de
  // verdad ante reclamos. Ahora el servidor RECALCULA el árbol desde los
  // inputs crudos (items, trailers, tc) con el mismo motor (computeQuote) y
  // SOBREESCRIBE quote con el resultado autoritativo antes de hashear. Si los
  // inputs vienen corruptos y el recálculo falla, conservamos lo que mandó el
  // cliente (best-effort) en vez de rechazar la emisión.
  if (Array.isArray(body.snapshot.items) && Array.isArray(body.snapshot.trailers)) {
    try {
      const tcSnap = Number(body.snapshot.meta.tc) || 0;
      body.snapshot.quote = computeQuote(body.snapshot.items, body.snapshot.trailers, tcSnap);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[emitidas] recompute falló, uso quote del cliente:', e);
    }
  }

  // Hash determinístico DESPUÉS del recálculo: certifica el árbol autoritativo.
  const snapshot_hash = await hashSnapshot(body.snapshot);

  const meta = body.snapshot.meta;

  // vendedor AUTORITATIVO del servidor: nombre del perfil del usuario
  // autenticado, NO el `vendedor` que mandó el cliente. Antes el cliente
  // podía firmar el registro inmutable con el nombre de otra persona. Si no
  // hay nombre en el perfil, caemos al email del usuario.
  const { data: prof } = await sb
    .from('user_profiles')
    .select('name')
    .eq('user_id', user.id)
    .maybeSingle();
  const vendedorServidor = (prof?.name?.trim() || user.email || 'unknown') as string;

  const row = {
    user_id: user.id,
    tipo: body.tipo,
    numero: body.numero.trim(),
    cliente: meta.cliente ?? null,
    contacto: meta.contacto ?? null,
    direccion: meta.direccion ?? null,
    vendedor: vendedorServidor,
    tc: meta.tc,
    fecha_emision: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    snapshot: body.snapshot,
    snapshot_hash,
  };

  const { data, error } = await sb
    .from('cotizaciones_emitidas')
    .insert([row])
    .select('id, created_at, snapshot_hash')
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[cotizaciones/emitidas POST]', {
      user: user.email,
      tipo: body.tipo,
      numero: body.numero,
      code: error.code,
      msg: error.message,
    });
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    created_at: data.created_at,
    snapshot_hash: data.snapshot_hash,
  });
}

export async function GET(req: NextRequest) {
  const sb = await getAuthedSupabase();
  if (!sb) return NextResponse.json({ items: [] });

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ items: [] }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200);

  if (id) {
    // Detalle: incluye snapshot completo
    const { data, error } = await sb
      .from('cotizaciones_emitidas')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ item: data });
  }

  // Listado: solo metadata
  const { data, error } = await sb
    .from('cotizaciones_emitidas')
    .select('id, tipo, numero, cliente, vendedor, fecha_emision, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
