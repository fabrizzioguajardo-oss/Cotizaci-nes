import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { CotizacionSaved } from '@/types';

// GET: lista de cotizaciones recientes
export async function GET() {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ cotizaciones: [], message: 'Supabase no configurado' });
  }
  const { data, error } = await sb
    .from('cotizaciones')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cotizaciones: data ?? [] });
}

// POST: guardar una cotización
export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json(
      { message: 'Supabase no configurado', saved: false },
      { status: 200 },
    );
  }
  let body: CotizacionSaved;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('cotizaciones')
    .insert([body])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cotizacion: data, saved: true });
}
