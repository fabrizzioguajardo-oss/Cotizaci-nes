import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// GET: lista de precios vigentes (más reciente primero)
export async function GET() {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json(
      { precios: [], message: 'Supabase no configurado' },
      { status: 200 },
    );
  }
  const { data, error } = await sb
    .from('precios_base')
    .select('*')
    .order('fecha_vigencia', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ precios: data ?? [] });
}
