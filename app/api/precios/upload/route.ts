import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { ParsedPrecio } from '@/lib/excelParser';

interface UploadBody {
  precios: ParsedPrecio[];
  archivo_origen: string;
}

// POST: bulk insert de precios parseados del Excel
export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json(
      {
        message: 'Supabase no configurado — los precios se procesaron localmente pero no se persistieron',
        inserted: 0,
      },
      { status: 200 },
    );
  }

  let body: UploadBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // Filtrar warnings y limpiar el shape para Supabase
  const rows = body.precios
    .filter((p) => !p.warning)
    .map(({ rowIndex, warning, ...rest }) => ({
      ...rest,
      subido_por: 'Diego Cortes',
    }));

  if (rows.length === 0) {
    return NextResponse.json({ message: 'No hay filas válidas para insertar', inserted: 0 });
  }

  const { error } = await sb.from('precios_base').insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Registro en historial
  await sb.from('precios_historial').insert([
    {
      tipo_resina: 'mixed',
      precio_anterior: null,
      precio_nuevo: null,
      fecha_cambio: new Date().toISOString().slice(0, 10),
      archivo_origen: body.archivo_origen,
    },
  ]);

  return NextResponse.json({
    message: `${rows.length} precios cargados exitosamente`,
    inserted: rows.length,
  });
}
