// Genera 3 templates BLANK (estructura + filas de ejemplo ficticias).
// Estos sí se pueden publicar en GitHub porque no contienen precios reales.
// Sirven para que admins descarguen el template, lo llenen con sus precios
// reales, y lo suban via /cotizador/precios (donde va a Supabase, NO al repo).

import * as XLSX from 'xlsx';
import { mkdirSync } from 'fs';

const OUT_DIRS = [
  `${process.cwd()}/public/templates`,
  `${process.cwd()}/templates`,
];

OUT_DIRS.forEach((d) => mkdirSync(d, { recursive: true }));

function styleHeader(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const cols: { wch: number }[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxLen = 12;
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v != null) {
        const len = String(cell.v).length;
        if (len > maxLen) maxLen = len;
      }
    }
    cols.push({ wch: Math.min(35, maxLen + 2) });
  }
  ws['!cols'] = cols;
}

function readmeSheet(lines: string[]): XLSX.WorkSheet {
  const data = lines.map((l) => [l]);
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 100 }];
  return ws;
}

function writeAll(filename: string, wb: XLSX.WorkBook): void {
  for (const dir of OUT_DIRS) {
    XLSX.writeFile(wb, `${dir}/${filename}`);
    console.log(`  ✓ ${dir}/${filename}`);
  }
}

// ============================================================
// EDSA — template_blank_EDSA.xlsx
// ============================================================

console.log('Generando template EDSA blank...');
{
  const wb = XLSX.utils.book_new();

  const readme = readmeSheet([
    'TEMPLATE BLANK - Precios EDSA / Extruidos',
    '',
    'Este es el template VACÍO con estructura y filas de ejemplo ficticias.',
    'Llénalo con tus precios reales y súbelo al cotizador en:',
    '  https://cotizaci-nes.vercel.app/cotizador/precios',
    '',
    'NO subas este archivo con datos reales a GitHub — los precios son confidenciales.',
    'El cotizador guarda los precios en Supabase, no en el repo.',
    '',
    'COLUMNAS DE LA HOJA "Precios":',
    '',
    '  tipo_producto:  manual | semi | auto | auto_c50_semi_hp | hp300 | hp350 | preesti',
    '  ancho:          ancho del rollo en pulgadas (ej. 18, 19.7, 20)',
    '  calibres:       lista separada por coma (ej. "50,60,70,80") o vacío',
    '  cono:           peso del cono en kg (0.35, 0.40, 0.44, 0.50, 0.60, 0.80, 1.0)',
    '  peso_neto:      PN del rollo en kg',
    '  peso_total:     PB = PN + cono en kg',
    '  precio_mxn_kg:  costo MXN por kg base',
    '  fecha_vigencia: YYYY-MM-DD desde cuándo aplica',
    '  notas:          opcional',
    '',
    'CONOS DISPONIBLES POR CONVENCIÓN:',
    '  Manual: 0.350, 0.400, 0.440, 0.500, 0.600, 0.800',
    '  Semi/Auto: 0.8, 1.0, 1.2, 1.4, 2.0',
    '  Pre-estirado: 0.35 - 0.8',
    '',
    'BORRA LAS FILAS DE EJEMPLO antes de subir tu archivo real.',
  ]);
  XLSX.utils.book_append_sheet(wb, readme, 'README');

  // Filas de ejemplo con valores FICTICIOS claramente marcados
  const sample = [
    { tipo_producto: 'EJEMPLO_BORRAR', ancho: 18, calibres: '50,60,70,80', cono: 0.35, peso_neto: 2.0, peso_total: 2.35, precio_mxn_kg: 0.0, fecha_vigencia: '2026-01-01', notas: 'BORRAR esta fila antes de usar' },
    { tipo_producto: 'manual', ancho: 18, calibres: '70', cono: 0.6, peso_neto: 0, peso_total: 0, precio_mxn_kg: 0, fecha_vigencia: '', notas: '' },
    { tipo_producto: 'manual', ancho: 20, calibres: '80', cono: 0.6, peso_neto: 0, peso_total: 0, precio_mxn_kg: 0, fecha_vigencia: '', notas: '' },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  styleHeader(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Precios');

  writeAll('template_blank_EDSA.xlsx', wb);
}

// ============================================================
// COLOR — template_blank_color.xlsx
// ============================================================

console.log('\nGenerando template Color blank...');
{
  const wb = XLSX.utils.book_new();

  const readme = readmeSheet([
    'TEMPLATE BLANK - Precios Color / Reciclado-Virgen / Intenso',
    '',
    'Este es el template VACÍO. Llénalo con tus precios reales y súbelo a:',
    '  https://cotizaci-nes.vercel.app/cotizador/precios',
    '',
    'NO subas este archivo con datos reales a GitHub.',
    '',
    'COLUMNAS DE LA HOJA "Precios":',
    '',
    '  tipo_resina:    virgen | reciclado | color',
    '  tipo_color:     clear | orange | black | blue | red | green | yellow | custom',
    '  tipo_producto:  manual | semi | auto',
    '  ancho:          pulgadas',
    '  calibre:        un solo calibre',
    '  cono:           peso del cono en kg',
    '  peso_neto:      PN',
    '  peso_total:     PB',
    '  precio_mxn_kg:  costo MXN/kg',
    '  master:         master color MXN/kg (opcional)',
    '  intenso:        adder por intenso MXN/kg (opcional)',
    '  fecha_vigencia: YYYY-MM-DD',
    '  notas:          opcional',
    '',
    'BORRA LAS FILAS DE EJEMPLO antes de subir tu archivo real.',
  ]);
  XLSX.utils.book_append_sheet(wb, readme, 'README');

  const sample = [
    { tipo_resina: 'EJEMPLO_BORRAR', tipo_color: 'orange', tipo_producto: 'manual', ancho: 18, calibre: 80, cono: 0.6, peso_neto: 2.8, peso_total: 3.4, precio_mxn_kg: 0.0, master: 0.0, intenso: '', fecha_vigencia: '2026-01-01', notas: 'BORRAR' },
    { tipo_resina: 'color', tipo_color: '', tipo_producto: 'manual', ancho: 18, calibre: 80, cono: 0.6, peso_neto: 0, peso_total: 0, precio_mxn_kg: 0, master: 0, intenso: '', fecha_vigencia: '', notas: '' },
    { tipo_resina: 'reciclado', tipo_color: '', tipo_producto: 'manual', ancho: 20, calibre: 80, cono: 0.6, peso_neto: 0, peso_total: 0, precio_mxn_kg: 0, master: '', intenso: '', fecha_vigencia: '', notas: '' },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  styleHeader(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Precios');

  writeAll('template_blank_color.xlsx', wb);
}

// ============================================================
// TARIMA — template_blank_tarima.xlsx
// ============================================================

console.log('\nGenerando template Tarima blank...');
{
  const wb = XLSX.utils.book_new();

  const readme = readmeSheet([
    'TEMPLATE BLANK - Cantidad por Tarima',
    '',
    'Llénalo con tus SKUs reales + reglas de tarima y súbelo a:',
    '  https://cotizaci-nes.vercel.app/cotizador/precios',
    '',
    '2 hojas requeridas:',
    '',
    '  "Catalogo": un row por SKU histórico (catálogo de productos)',
    '    codigo_alterno:  identificador comercial ("18\\" 80 3.4 C600")',
    '    codigo_edsa:     codigo interno (opcional)',
    '    ancho:           pulgadas',
    '    calibre:         GA',
    '    peso_neto:       PN kg',
    '    peso_cono:       cono kg',
    '    peso_total:      PB = PN + cono',
    '    largo_real:      ft calculado',
    '    largo_aprox:     ft redondeado (etiqueta cliente)',
    '',
    '  "Reglas": rangos de tarima por peso total',
    '    ancho:              pulgadas',
    '    peso_min:           PB min del rango',
    '    peso_max:           PB max del rango',
    '    pz_por_cama:        rollos por cama',
    '    camas_por_tarima:   numero de camas',
    '    total_rollos:       resultado = pz_por_cama × camas_por_tarima',
    '',
    'BORRA LAS FILAS DE EJEMPLO antes de usar.',
  ]);
  XLSX.utils.book_append_sheet(wb, readme, 'README');

  const sampleCat = [
    { codigo_alterno: 'EJEMPLO BORRAR', codigo_edsa: '', ancho: 18, calibre: 80, peso_neto: 2.8, peso_cono: 0.6, peso_total: 3.4, largo_real: 715, largo_aprox: 700 },
    { codigo_alterno: '', codigo_edsa: '', ancho: 18, calibre: 80, peso_neto: 0, peso_cono: 0.6, peso_total: 0, largo_real: 0, largo_aprox: 0 },
  ];
  const wsCat = XLSX.utils.json_to_sheet(sampleCat);
  styleHeader(wsCat);
  XLSX.utils.book_append_sheet(wb, wsCat, 'Catalogo');

  const sampleReg = [
    { ancho: 18, peso_min: 1.1, peso_max: 1.8, pz_por_cama: 100, camas_por_tarima: 4, total_rollos: 400 },
    { ancho: 18, peso_min: 1.9, peso_max: 2.9, pz_por_cama: 80, camas_por_tarima: 4, total_rollos: 320 },
    { ancho: 18, peso_min: 3.0, peso_max: 6.0, pz_por_cama: 64, camas_por_tarima: 4, total_rollos: 256 },
  ];
  const wsReg = XLSX.utils.json_to_sheet(sampleReg);
  styleHeader(wsReg);
  XLSX.utils.book_append_sheet(wb, wsReg, 'Reglas');

  writeAll('template_blank_tarima.xlsx', wb);
}

console.log('\n✓ Templates blank generados (sin precios reales).');
