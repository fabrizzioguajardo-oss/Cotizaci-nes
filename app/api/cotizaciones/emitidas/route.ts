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

  // Hash determinístico del snapshot (sirve para auditar si alguien
  // modifica el JSON con acceso directo a la base — el hash dejaría
  // de coincidir).
  const snapshot_hash = await hashSnapshot(body.snapshot);

  const meta = body.snapshot.meta;
  const row = {
    user_id: user.id,
    tipo: body.tipo,
    numero: body.numero.trim(),
    cliente: meta.cliente ?? null,
    contacto: meta.contacto ?? null,
    direccion: meta.direccion ?? null,
    vendedor: meta.vendedor,
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
