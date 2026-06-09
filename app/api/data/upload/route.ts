// POST /api/data/upload
// Acepta: multipart/form-data con fields: file (Blob), kind ('edsa'|'color'|'tarima')
// Output: { ok, kind, stats, warnings_count, source_filename }
//
// El parsing corre server-side (mas rapido y consistente). El resultado se guarda
// en Supabase si esta configurado, sino se devuelve solo al cliente para que
// lo guarde donde quiera (localStorage / sessionStorage).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer as getAuthedSupabase } from '@/lib/supabaseServer';
import { parseEDSAFile } from '@/lib/parsers/edsaParser';
import { parseColorFile } from '@/lib/parsers/colorParser';
import { parseTarimaFile } from '@/lib/parsers/tarimaParser';
import { parseProductosEDSAFile } from '@/lib/parsers/productosEDSAParser';
import {
  parseEDSATemplate,
  parseColorTemplate,
  parseTarimaTemplate,
  isCleanTemplate,
} from '@/lib/parsers/flatTemplateParser';

export const runtime = 'nodejs'; // necesitamos Node, no Edge (xlsx usa Buffer)


type Kind = 'edsa' | 'color' | 'tarima' | 'productos_edsa';

function isKind(s: string): s is Kind {
  return s === 'edsa' || s === 'color' || s === 'tarima' || s === 'productos_edsa';
}

export async function POST(req: NextRequest) {
  // AUTENTICAR ANTES DE PARSEAR (bug M4 — DoS sin login): el parse de xlsx es
  // pesado; un anónimo no debe poder gastar CPU/memoria del server con un
  // archivo grande/malicioso antes de ser rechazado. Si Supabase está
  // configurado (producción) exigimos sesión aquí mismo. Sin Supabase = modo
  // demo local (sin persistencia), se permite.
  const sb = await getAuthedSupabase();
  let user: { email?: string | null } | null = null;
  if (sb) {
    const { data } = await sb.auth.getUser();
    if (!data.user) {
      return NextResponse.json(
        { error: 'No estas autenticado. Vuelve a iniciar sesion.' },
        { status: 401 },
      );
    }
    user = data.user;
  }

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
    return NextResponse.json({ error: 'kind debe ser edsa|color|tarima|productos_edsa' }, { status: 400 });
  }

  // Límite de tamaño: los Excel de precios son chicos (<1MB típico). Acota el
  // costo de parseo incluso para usuarios autenticados (zip-bomb / hoja enorme).
  const MAX_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo es demasiado grande (máx 15 MB).' }, { status: 413 });
  }

  const filename = (file instanceof File ? file.name : '') || `upload-${Date.now()}.xlsx`;
  const buffer = await file.arrayBuffer();

  // Auto-detect: ¿template limpio o formato legacy?
  // productos_edsa no tiene formato template; siempre se trata como legacy
  // y se delega al parser dedicado mas abajo.
  let isTemplate = false;
  if (kindStr === 'edsa' || kindStr === 'color' || kindStr === 'tarima') {
    try {
      isTemplate = isCleanTemplate(buffer, kindStr);
    } catch {
      isTemplate = false;
    }
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
    } else if (kindStr === 'tarima') {
      const r = isTemplate ? parseTarimaTemplate(buffer) : parseTarimaFile(buffer);
      payload = { catalogo: r.catalogo, rangos: r.rangos };
      stats = {
        skus: r.catalogo.length,
        rangos: r.rangos.length,
        warnings: r.warnings.length,
      };
      warnings = r.warnings;
      formatUsed = isTemplate ? 'template' : 'legacy';
    } else {
      // productos_edsa — tabla maestra de SKUs EDSA (no tiene formato template)
      const r = parseProductosEDSAFile(buffer);
      payload = { catalogo: r.catalogo };
      stats = {
        skus: r.catalogo.length,
        sheets_processed: r.sheetsProcessed.length,
        warnings: r.warnings.length,
      };
      warnings = r.warnings;
      formatUsed = 'legacy';
    }
    stats.format = formatUsed;
  } catch (err) {
    return NextResponse.json(
      { error: `Error parseando: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 400 },
    );
  }

  // Guardar en Supabase usando el cliente AUTENTICADO con sesion del usuario.
  // Esto es necesario porque las RLS policies en price_data_files requieren
  // que auth.uid() pertenezca a un user_profiles con role='admin'. Con el
  // cliente anon (singleton) auth.uid() es null y RLS rechaza con
  // "new row violates row-level security policy".
  if (sb && user) {
    // Auth ya verificada al inicio del handler. El RLS valida que el usuario
    // sea admin en el insert; si no lo es, falla con un mensaje claro.
    // Marcar versiones anteriores del mismo kind como obsoletas
    await sb.from('price_data_files').update({ vigente: false }).eq('kind', kindStr).eq('vigente', true);

    const { error } = await sb.from('price_data_files').insert([
      {
        kind: kindStr,
        source_filename: filename,
        uploaded_by: user.email ?? 'unknown',
        stats,
        data: payload,
        vigente: true,
      },
    ]);
    if (error) {
      // Log detalles para diagnostico
      // eslint-disable-next-line no-console
      console.error('[upload]', {
        user: user.email,
        kind: kindStr,
        rls_code: error.code,
        message: error.message,
      });
      // Mensaje user-friendly si RLS rechazo (no eres admin)
      const isRLS = error.message?.includes('row-level security') || error.code === '42501';
      const userMessage = isRLS
        ? `Tu cuenta (${user.email}) no tiene permisos de admin para subir precios. Pidele a Fabrizzio que te agregue como admin.`
        : `Supabase insert fallo: ${error.message}`;
      return NextResponse.json(
        { error: userMessage, code: error.code, parsed_stats: stats },
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
