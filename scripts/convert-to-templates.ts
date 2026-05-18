// Convierte los 3 archivos reales (formato legacy de Diego) a los templates
// limpios que el cotizador acepta. NO se pierde información — cada fila
// del legacy se traduce a una fila del template.
//
// Uso:
//   npx tsx scripts/convert-to-templates.ts <edsa.xlsx> <color.xlsx> <tarima.xlsx>
//
// Output:
//   templates/<NOMBRE_ORIGINAL>_template_EDSA.xlsx
//   templates/<NOMBRE_ORIGINAL>_template_color.xlsx
//   templates/<NOMBRE_ORIGINAL>_template_tarima.xlsx

import * as XLSX from 'xlsx';
import { readFileSync, mkdirSync } from 'fs';
import { basename } from 'path';
import { parseEDSAFile } from '../lib/parsers/edsaParser';
import { parseColorFile } from '../lib/parsers/colorParser';
import { parseTarimaFile } from '../lib/parsers/tarimaParser';

const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Uso: tsx scripts/convert-to-templates.ts <edsa> <color> <tarima>');
  process.exit(1);
}
const [edsaPath, colorPath, tarimaPath] = args;

const TEMPLATES_DIR = `${process.cwd()}/templates`;
mkdirSync(TEMPLATES_DIR, { recursive: true });

// Helper: sanitize filename
function safeName(path: string): string {
  return basename(path).replace(/\.xlsx$/i, '').replace(/[^\w-]/g, '_');
}

// Helper: copia una hoja del workbook origen a otro workbook con prefijo
// "ref_" para indicar que es de referencia (no la parsea el cotizador, solo
// se preserva para que no se pierda informacion).
function copySheetAsRef(
  srcWb: XLSX.WorkBook,
  destWb: XLSX.WorkBook,
  sheetName: string,
): void {
  const sheet = srcWb.Sheets[sheetName];
  if (!sheet) return;
  // Cloning to avoid mutation
  const cloned = XLSX.utils.aoa_to_sheet(
    XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }),
  );
  // Truncar prefijo "ref_" + nombre limpio (Excel limita a 31 chars)
  const safeRef = `ref_${sheetName.replace(/[\\\/\*\[\]\?:]/g, '_').slice(0, 26)}`.slice(0, 31);
  XLSX.utils.book_append_sheet(destWb, cloned, safeRef);
}

// Helper: auto-width columnas
function styleHeader(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const cols: { wch: number }[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxLen = 10;
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v != null) {
        const len = String(cell.v).length;
        if (len > maxLen) maxLen = len;
      }
    }
    cols.push({ wch: Math.min(40, maxLen + 2) });
  }
  ws['!cols'] = cols;
}

function readmeSheet(lines: string[]): XLSX.WorkSheet {
  const data = lines.map((l) => [l]);
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 100 }];
  return ws;
}

// ============================================================
// EDSA
// ============================================================

console.log('='.repeat(70));
console.log('Procesando EDSA:', edsaPath);
console.log('='.repeat(70));

const edsaBuf = readFileSync(edsaPath).buffer as ArrayBuffer;
const edsa = parseEDSAFile(edsaBuf);

console.log(`Sheets procesadas: ${edsa.sheetsProcessed.length}`);
edsa.sheetsProcessed.forEach((s) => console.log(`  ✓ ${s}`));
console.log(`Sheets saltadas: ${edsa.sheetsSkipped.length}`);
edsa.sheetsSkipped.forEach((s) => console.log(`  ⏸ ${s.name} — ${s.reason}`));
console.log(`Total filas extraídas: ${edsa.rows.length}`);
console.log(`Warnings: ${edsa.warnings.length}`);
if (edsa.warnings.length > 0) {
  edsa.warnings.slice(0, 10).forEach((w) => console.log(`  ⚠ ${w}`));
}

const edsaFlat = edsa.rows.map((r) => ({
  tipo_producto: r.product_type,
  ancho: r.ancho,
  calibres: r.calibres.filter((c) => c > 0).join(','),
  cono: r.cono,
  peso_neto: Number(r.peso_neto.toFixed(4)),
  peso_total: Number(r.peso_total.toFixed(4)),
  precio_mxn_kg: Number(r.precio_mxn_kg.toFixed(4)),
  fecha_vigencia: '',
  source_sheet: r.source_sheet,
  notas: '',
}));

// Stats por tipo_producto
const byType = edsaFlat.reduce<Record<string, number>>((acc, r) => {
  acc[r.tipo_producto] = (acc[r.tipo_producto] || 0) + 1;
  return acc;
}, {});
console.log('Distribución por tipo:', byType);

{
  const wb = XLSX.utils.book_new();
  const srcWb = XLSX.read(edsaBuf, { type: 'array' });

  const readme = readmeSheet([
    'Template Precios EDSA generado desde el archivo legacy',
    '',
    `Archivo original: ${basename(edsaPath)}`,
    `Total productos parseados: ${edsaFlat.length}`,
    `Generado: ${new Date().toISOString()}`,
    '',
    'HOJA "Precios" (la que lee el cotizador):',
    '  tipo_producto:  manual | semi | auto | auto_c50_semi_hp | hp300 | hp350 | preesti',
    '  ancho:          pulgadas (18, 19.7, 20)',
    '  calibres:       lista separada por coma (ej. "50,60,70,80") o vacio',
    '  cono:           peso del cono kg (0.35, 0.4, 0.44, etc.)',
    '  peso_neto:      PN kg del rollo',
    '  peso_total:     PB kg = PN + cono',
    '  precio_mxn_kg:  costo MXN por kg base',
    '  fecha_vigencia: YYYY-MM-DD (vacio = sin info)',
    '  source_sheet:   referencia a la hoja del archivo original',
    '',
    'HOJAS "ref_*" (REFERENCIA — no las parsea el cotizador):',
    '  Estas son las hojas originales del archivo de Diego que tienen info que NO',
    '  cabe en la estructura plana de "Precios". Se preservan para que NO SE PIERDA',
    '  ninguna informacion. Incluyen:',
    '  - ref_MEDIDAS_ESPECIALES: TERMOENCOGIBLE, antiestaticos, BIO+, COLOR+, etc.',
    '  - ref_Matriz_de_costos: tabla maestra de precios por tipo (Manual/Semi/Auto/HP)',
    '  - ref_Resumen_unificado: matriz 2D PB x cono -> MXN/kg',
    '  - ref_Resumen_Peso_Total / Peso_Neto: tablas de validacion',
    '  - ref_Condiciones_Comerciales: terminos de pago, vigencia, lugar entrega',
    '  - ref_Metodologia: docs de como Diego calcula',
    '  - ref_Politica_M_C: politicas master color',
    '',
    'NOTAS:',
    '- Este template se sube directo al cotizador (auto-detect lo procesa).',
    '- Las hojas ref_* no afectan el cotizador, son para referencia humana.',
    '- Cuando Diego cambie precios, edita la fila correspondiente en "Precios"',
    '  Y opcionalmente actualiza las ref_* tambien.',
  ]);
  XLSX.utils.book_append_sheet(wb, readme, 'README');

  // Hoja principal "Precios" (parseada)
  const ws = XLSX.utils.json_to_sheet(edsaFlat);
  styleHeader(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Precios');

  // Copiar hojas de referencia para preservar TODA la informacion del archivo
  const refSheets = [
    'MEDIDAS ESPECIALES',
    'Matriz de costos',
    'Resumen unificado',
    'Resumen Peso Total',
    'Resumen Peso Neto',
    'Condiciones Comerciales',
    'Metodología 20260420',
    'Calculo Incr. Resinaa Rec.',
    'Politica de M.C.',
  ];
  let refCount = 0;
  for (const name of refSheets) {
    if (srcWb.Sheets[name]) {
      copySheetAsRef(srcWb, wb, name);
      refCount++;
    }
  }
  console.log(`Hojas de referencia copiadas: ${refCount}`);

  const out = `${TEMPLATES_DIR}/${safeName(edsaPath)}_template_EDSA.xlsx`;
  XLSX.writeFile(wb, out);
  console.log(`\n✓ Escrito: ${out}`);
}

// ============================================================
// COLOR
// ============================================================

console.log('\n' + '='.repeat(70));
console.log('Procesando COLOR:', colorPath);
console.log('='.repeat(70));

const colorBuf = readFileSync(colorPath).buffer as ArrayBuffer;
const color = parseColorFile(colorBuf);

console.log(`Sheets procesadas: ${color.sheetsProcessed.length}`);
color.sheetsProcessed.forEach((s) => console.log(`  ✓ ${s}`));
console.log(`Sheets saltadas: ${color.sheetsSkipped.length}`);
color.sheetsSkipped.forEach((s) => console.log(`  ⏸ ${s.name} — ${s.reason}`));
console.log(`Total filas extraídas: ${color.rows.length}`);
console.log(`Warnings: ${color.warnings.length}`);
if (color.warnings.length > 0) {
  color.warnings.slice(0, 10).forEach((w) => console.log(`  ⚠ ${w}`));
}

const colorFlat = color.rows.map((r) => ({
  tipo_resina: r.resin_class,
  tipo_color: r.color || '',
  tipo_producto: r.product_type,
  ancho: r.ancho,
  calibre: r.calibres[0] || 0,
  cono: r.cono,
  peso_neto: Number(r.peso_neto.toFixed(4)),
  peso_total: Number(r.peso_total.toFixed(4)),
  precio_mxn_kg: Number(r.precio_mxn_kg.toFixed(4)),
  master: r.master_mxn_kg !== undefined ? Number(r.master_mxn_kg.toFixed(4)) : '',
  intenso: r.intenso_mxn_kg !== undefined ? Number(r.intenso_mxn_kg.toFixed(4)) : '',
  fecha_vigencia: '',
  source_sheet: r.source_sheet,
  notas: '',
}));

// Stats
const colorByClass = colorFlat.reduce<Record<string, number>>((acc, r) => {
  acc[r.tipo_resina] = (acc[r.tipo_resina] || 0) + 1;
  return acc;
}, {});
console.log('Distribución por resin_class:', colorByClass);

{
  const wb = XLSX.utils.book_new();
  const srcWb = XLSX.read(colorBuf, { type: 'array' });

  const readme = readmeSheet([
    'Template Precios Color generado desde el archivo legacy',
    '',
    `Archivo original: ${basename(colorPath)}`,
    `Total productos parseados: ${colorFlat.length}`,
    `Generado: ${new Date().toISOString()}`,
    '',
    'HOJA "Precios" (la que lee el cotizador):',
    '  tipo_resina:    virgen | reciclado | color',
    '  tipo_color:     clear | orange | black | blue | red | green | yellow | (vacio)',
    '  tipo_producto:  manual | semi | auto',
    '  ancho:          pulgadas',
    '  calibre:        un solo calibre numerico',
    '  cono:           peso cono kg',
    '  peso_neto:      PN kg',
    '  peso_total:     PB kg = PN + cono',
    '  precio_mxn_kg:  costo MXN por kg final',
    '  master:         master color MXN/kg (puede estar vacio)',
    '  intenso:        intenso MXN/kg (puede estar vacio)',
    '  source_sheet:   referencia a la hoja original',
    '',
    'HOJAS "ref_*" (REFERENCIA — no las parsea el cotizador):',
    '  Hojas auxiliares del archivo original que se preservan para no perder info.',
    '',
    'NOTAS:',
    '- Cada producto puede aparecer en varias filas para distintas variantes',
    '  (P. Reciclado, P. Virgen, Intenso Reciclado, Intenso Virgen).',
    '- El cotizador busca por (ancho, cono, peso_total, resin_class) al consultar.',
  ]);
  XLSX.utils.book_append_sheet(wb, readme, 'README');

  const ws = XLSX.utils.json_to_sheet(colorFlat);
  styleHeader(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Precios');

  // Copiar hoja auxiliar si existe
  const refSheets = ['Hoja1'];
  let refCount = 0;
  for (const name of refSheets) {
    if (srcWb.Sheets[name]) {
      // Solo copiar si tiene contenido real
      const json = XLSX.utils.sheet_to_json(srcWb.Sheets[name], { header: 1, defval: null });
      const hasContent = json.some((row) => Array.isArray(row) && row.some((v) => v != null && v !== ''));
      if (hasContent) {
        copySheetAsRef(srcWb, wb, name);
        refCount++;
      }
    }
  }
  console.log(`Hojas de referencia copiadas: ${refCount}`);

  const out = `${TEMPLATES_DIR}/${safeName(colorPath)}_template_color.xlsx`;
  XLSX.writeFile(wb, out);
  console.log(`\n✓ Escrito: ${out}`);
}

// ============================================================
// TARIMA
// ============================================================

console.log('\n' + '='.repeat(70));
console.log('Procesando TARIMA:', tarimaPath);
console.log('='.repeat(70));

const tarimaBuf = readFileSync(tarimaPath).buffer as ArrayBuffer;
const tarima = parseTarimaFile(tarimaBuf);

console.log(`SKUs en catalogo: ${tarima.catalogo.length}`);
console.log(`Rangos en general: ${tarima.rangos.length}`);
console.log(`Warnings: ${tarima.warnings.length}`);
if (tarima.warnings.length > 0) {
  tarima.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}

const tarimaCatalogo = tarima.catalogo.map((c) => ({
  codigo_alterno: c.codigo_alterno ?? '',
  codigo_edsa: c.codigo_edsa ?? '',
  ancho: c.ancho,
  calibre: c.calibre,
  peso_neto: Number(c.peso_neto.toFixed(4)),
  peso_cono: c.peso_cono,
  peso_total: Number(c.peso_total.toFixed(4)),
  largo_real: c.largo_real !== null ? Number(c.largo_real.toFixed(2)) : '',
  largo_aprox: c.largo_aprox ?? '',
  codigo_generado: c.codigo_generado ?? '',
}));

const tarimaRangos = tarima.rangos.map((r) => ({
  ancho: r.ancho,
  peso_min: r.peso_min,
  peso_max: r.peso_max,
  pz_por_cama: r.pz_por_cama,
  camas_por_tarima: r.camas_por_tarima,
  total_rollos: r.total_rollos,
}));

{
  const wb = XLSX.utils.book_new();
  const readme = readmeSheet([
    'Template Tarima generado desde el archivo legacy',
    '',
    `Archivo original: ${basename(tarimaPath)}`,
    `SKUs: ${tarimaCatalogo.length}`,
    `Reglas: ${tarimaRangos.length}`,
    `Generado: ${new Date().toISOString()}`,
    '',
    'HOJA "Catalogo": un row por SKU especifico de Diego',
    '  codigo_alterno:  identificador comercial (ej. "18\\" 80 3.4 C600")',
    '  codigo_edsa:     codigo interno',
    '  ancho:           pulgadas',
    '  calibre:         GA',
    '  peso_neto:       PN kg',
    '  peso_cono:       cono kg',
    '  peso_total:      PB kg',
    '  largo_real:      ft calculado',
    '  largo_aprox:     ft redondeado (etiqueta)',
    '  codigo_generado: ID interno',
    '',
    'HOJA "Reglas": rangos de tarima por ancho y peso',
    '  ancho:              pulgadas',
    '  peso_min:           PB min del rango',
    '  peso_max:           PB max del rango',
    '  pz_por_cama:        rollos por cama',
    '  camas_por_tarima:   numero de camas',
    '  total_rollos:       pz_por_cama × camas_por_tarima',
  ]);
  XLSX.utils.book_append_sheet(wb, readme, 'README');

  const wsCat = XLSX.utils.json_to_sheet(tarimaCatalogo);
  styleHeader(wsCat);
  XLSX.utils.book_append_sheet(wb, wsCat, 'Catalogo');

  const wsReg = XLSX.utils.json_to_sheet(tarimaRangos);
  styleHeader(wsReg);
  XLSX.utils.book_append_sheet(wb, wsReg, 'Reglas');

  const out = `${TEMPLATES_DIR}/${safeName(tarimaPath)}_template_tarima.xlsx`;
  XLSX.writeFile(wb, out);
  console.log(`\n✓ Escrito: ${out}`);
}

console.log('\n' + '='.repeat(70));
console.log('FIN. Templates generados en /templates/');
console.log('='.repeat(70));
