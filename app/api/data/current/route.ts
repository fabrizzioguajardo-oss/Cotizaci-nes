// GET /api/data/current
// Devuelve el snapshot mas reciente de los 3 tipos de archivo (edsa, color, tarima).
// Si Supabase no tiene nada, responde 204 para que el cliente caiga al JSON estatico.

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { ParsedPriceRow, ParsedTarimaRow, ParsedTarimaRange } from '@/lib/parsers/types';

export const runtime = 'nodejs';

interface RowFromDB {
  kind: 'edsa' | 'color' | 'tarima';
  source_filename: string | null;
  uploaded_at: string;
  stats: Record<string, unknown>;
  data: { rows?: ParsedPriceRow[]; catalogo?: ParsedTarimaRow[]; rangos?: ParsedTarimaRange[] };
}

export async function GET() {
  const sb = getSupabase();
  if (!sb) {
    return new NextResponse(null, { status: 204 });
  }

  const { data, error } = await sb
    .from('price_data_files')
    .select('kind, source_filename, uploaded_at, stats, data')
    .eq('vigente', true)
    .order('uploaded_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  // Si no hay alguno, devolver 204 - mejor que el cliente caiga al JSON estatico
  if (!edsa || !color || !tarima) {
    return new NextResponse(null, { status: 204 });
  }

  const result = {
    generated_at: edsa.uploaded_at,
    source_files: {
      edsa: edsa.source_filename ?? '',
      color: color.source_filename ?? '',
      tarima: tarima.source_filename ?? '',
    },
    precios_edsa: edsa.data.rows ?? [],
    precios_color: color.data.rows ?? [],
    catalogo_tarima: tarima.data.catalogo ?? [],
    rangos_tarima: tarima.data.rangos ?? [],
    stats: {
      ...edsa.stats,
      ...color.stats,
      ...tarima.stats,
    },
  };

  return NextResponse.json(result);
}
