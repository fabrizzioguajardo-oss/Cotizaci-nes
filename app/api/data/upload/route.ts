// POST /api/data/upload
// Acepta: multipart/form-data con fields: file (Blob), kind ('edsa'|'color'|'tarima')
// Output: { ok, kind, stats, warnings_count, source_filename }
//
// El parsing corre server-side (mas rapido y consistente). El resultado se guarda
// en Supabase si esta configurado, sino se devuelve solo al cliente para que
// lo guarde donde quiera (localStorage / sessionStorage).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { parseEDSAFile } from '@/lib/parsers/edsaParser';
import { parseColorFile } from '@/lib/parsers/colorParser';
import { parseTarimaFile } from '@/lib/parsers/tarimaParser';
import {
  parseEDSATemplate,
  parseColorTemplate,
  parseTarimaTemplate,
  isCleanTemplate,
} from '@/lib/parsers/flatTemplateParser';

export const runtime = 'nodejs'; // necesitamos Node, no Edge (xlsx usa Buffer)

type Kind = 'edsa' | 'color' | 'tarima';

function isKind(s: string): s is Kind {
  return s === 'edsa' || s === 'color' || s === 'tarima';
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart/form-data inválido' }, { status: 400 });
  }

  const file = formData.get('file');
  const kindRaw = formData.get('kind');

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Falta campo file' }, { status: 400 });
  }
  const kindStr = typeof kindRaw === 'string' ? kindRaw : '';
  if (!isKind(kindStr)) {
    return NextResponse.json({ error: 'kind debe ser edsa|color|tarima' }, { status: 400 });
  }

  const filename = (file instanceof File ? file.name : '') || `upload-${Date.now()}.xlsx`;
  const buffer = await file.arrayBuffer();

  // Auto-detect: ¿template limpio o formato legacy?
  let isTemplate = false;
  try {
    isTemplate = isCleanTemplate(buffer, kindStr);
  } catch {
    isTemplate = false;
  }

  // Parsear según el tipo + formato
  let payload: Record<string, unknown>;
  let stats: Record<string, number | string>;
  let warnings: string[];
  let formatUsed: 'template' | 'legacy';

  try {
    if (kindStr === 'edsa') {
      const r = isTemplate ? parseEDSATemplate(buffer) : parseEDSAFile(buffer);
      payload = { rows: r.rows };
      stats = {
        rows: r.rows.length,
        warnings: r.warnings.length,
        sheets_processed: r.sheetsProcessed.length,
        sheets_skipped: r.sheetsSkipped.length,
      };
      warnings = r.warnings;
      formatUsed = isTemplate ? 'template' : 'legacy';
    } else if (kindStr === 'color') {
      const r = isTemplate ? parseColorTemplate(buffer) : parseColorFile(buffer);
      payload = { rows: r.rows };
      stats = {
        rows: r.rows.length,
        warnings: r.warnings.length,
        sheets_processed: r.sheetsProcessed.length,
        sheets_skipped: r.sheetsSkipped.length,
      };
      warnings = r.warnings;
      formatUsed = isTemplate ? 'template' : 'legacy';
    } else {
      const r = isTemplate ? parseTarimaTemplate(buffer) : parseTarimaFile(buffer);
      payload = { catalogo: r.catalogo, rangos: r.rangos };
      stats = {
        skus: r.catalogo.length,
        rangos: r.rangos.length,
        warnings: r.warnings.length,
      };
      warnings = r.warnings;
      formatUsed = isTemplate ? 'template' : 'legacy';
    }
    stats.format = formatUsed;
  } catch (err) {
    return NextResponse.json(
      { error: `Error parseando: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 400 },
    );
  }

  // Guardar en Supabase si esta configurado
  const sb = getSupabase();
  if (sb) {
    // Marcar versiones anteriores del mismo kind como obsoletas
    await sb.from('price_data_files').update({ vigente: false }).eq('kind', kindStr).eq('vigente', true);

    const { error } = await sb.from('price_data_files').insert([
      {
        kind: kindStr,
        source_filename: filename,
        uploaded_by: 'Diego Cortes',
        stats,
        data: payload,
        vigente: true,
      },
    ]);
    if (error) {
      return NextResponse.json(
        { error: `Supabase insert falló: ${error.message}`, parsed_stats: stats },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    kind: kindStr,
    source_filename: filename,
    stats,
    warnings_count: warnings.length,
    sample_warnings: warnings.slice(0, 5),
    persisted: !!sb,
    payload: !sb ? payload : undefined, // si no hay Supabase, devolver al cliente para localStorage
  });
}
