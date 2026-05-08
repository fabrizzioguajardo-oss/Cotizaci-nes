import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { CostCatalogEntry, CostCategory } from '@/types';

// GET /api/catalog?category=master  -> lista vigentes (opcionalmente filtra por categoria)
export async function GET(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ entries: [], message: 'Supabase no configurado' });
  }

  const url = new URL(req.url);
  const category = url.searchParams.get('category') as CostCategory | null;
  const includeObsolete = url.searchParams.get('all') === '1';

  let q = sb.from('cost_catalog').select('*');
  if (category) q = q.eq('category', category);
  if (!includeObsolete) q = q.eq('vigente', true);
  q = q.order('category').order('name');

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

// POST /api/catalog  -> crear nueva entrada (la marca como vigente y deja
// las anteriores con el mismo (category,name) como obsoletas).
export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json(
      { saved: false, message: 'Supabase no configurado' },
      { status: 200 },
    );
  }
  let body: CostCatalogEntry;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  // Marcar versiones anteriores con mismo nombre/categoria como obsoletas
  await sb
    .from('cost_catalog')
    .update({ vigente: false })
    .eq('category', body.category)
    .eq('name', body.name)
    .eq('vigente', true);

  const { id, created_at, ...insertable } = body;
  const { data, error } = await sb
    .from('cost_catalog')
    .insert([{ ...insertable, vigente: true }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data, saved: true });
}

// DELETE /api/catalog?id=...  -> marca como obsoleta (no borra, mantiene historia)
export async function DELETE(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ saved: false }, { status: 200 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const { error } = await sb
    .from('cost_catalog')
    .update({ vigente: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
