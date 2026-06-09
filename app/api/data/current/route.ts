// GET /api/data/current
// Devuelve el snapshot mas reciente disponible (1-3 tipos) de los archivos
// que admin ha subido al cotizador.
//
// IMPORTANTE: usa cliente AUTENTICADO con cookies del usuario porque las
// RLS policies en price_data_files requieren auth.uid() IS NOT NULL.
// Con cliente anon, las queries devuelven 0 rows aunque la data esté.

import { NextResponse } from 'next/server';
import { getSupabaseServer as getAuthedSupabase } from '@/lib/supabaseServer';
import type { ParsedPriceRow, ParsedTarimaRow, ParsedTarimaRange } from '@/lib/parsers/types';

export const runtime = 'nodejs';

interface RowFromDB {
  kind: 'edsa' | 'color' | 'tarima' | 'productos_edsa';
  source_filename: string | null;
  uploaded_at: string;
  stats: Record<string, unknown>;
  data: { rows?: ParsedPriceRow[]; catalogo?: ParsedTarimaRow[]; rangos?: ParsedTarimaRange[] };
}


export async function GET() {
  const sb = await getAuthedSupabase();
  if (!sb) {
    return new NextResponse(null, { status: 204 });
  }

  // Defensa en profundidad (B3): exigir sesión explícitamente, no depender solo
  // de RLS. Es el endpoint más sensible (precios EDSA/color/catálogo); si la
  // policy de price_data_files se aflojara, este 401 sigue cerrando la puerta.
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data, error } = await sb
    .from('price_data_files')
    .select('kind, source_filename, uploaded_at, stats, data')
    .eq('vigente', true)
    .order('uploaded_at', { ascending: false });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[data/current] read error:', error.code, error.message);
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  // Tomar el mas reciente por kind
  const byKind = new Map<string, RowFromDB>();
  for (const row of data as RowFromDB[]) {
    if (!byKind.has(row.kind)) byKind.set(row.kind, row);
  }

  const edsa = byKind.get('edsa');
  const color = byKind.get('color');
  const tarima = byKind.get('tarima');
  const productosEdsa = byKind.get('productos_edsa');

  // Devolver lo que esté disponible. Si nada → 204 para que UI muestre "sin precios".
  // Si hay AL MENOS uno, mandar partial — el cotizador maneja datos parciales
  // (ej. tiene EDSA pero no Tarima → cone selector limitado pero EDSA prices ok).
  if (!edsa && !color && !tarima && !productosEdsa) {
    return new NextResponse(null, { status: 204 });
  }

  const mostRecent = [edsa, color, tarima, productosEdsa]
    .filter((x): x is RowFromDB => !!x)
    .map((x) => new Date(x.uploaded_at).getTime())
    .reduce((acc, t) => Math.max(acc, t), 0);

  const result = {
    generated_at: new Date(mostRecent).toISOString(),
    source_files: {
      edsa: edsa?.source_filename ?? '',
      color: color?.source_filename ?? '',
      tarima: tarima?.source_filename ?? '',
      productos_edsa: productosEdsa?.source_filename ?? '',
    },
    precios_edsa: edsa?.data?.rows ?? [],
    precios_color: color?.data?.rows ?? [],
    catalogo_tarima: tarima?.data?.catalogo ?? [],
    rangos_tarima: tarima?.data?.rangos ?? [],
    productos_edsa: productosEdsa?.data?.catalogo ?? [],
    stats: {
      ...edsa?.stats,
      ...color?.stats,
      ...tarima?.stats,
      ...productosEdsa?.stats,
      kinds_loaded: [
        edsa && 'edsa',
        color && 'color',
        tarima && 'tarima',
        productosEdsa && 'productos_edsa',
      ].filter(Boolean).join(','),
    },
  };

  return NextResponse.json(result);
}
