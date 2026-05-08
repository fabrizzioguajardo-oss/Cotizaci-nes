// Genera 3 archivos Excel template que Diego puede usar como referencia
// para migrar a un formato mas plano y facil de parsear.
//
// Output:
//   templates/template_precios_EDSA.xlsx
//   templates/template_precios_color.xlsx
//   templates/template_tarima.xlsx
//
// Cada template incluye:
//   - Hoja README con instrucciones para Diego
//   - Hoja Precios/Catalogo con headers y filas de ejemplo del archivo real

import * as XLSX from 'xlsx';
import { readFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { parseEDSAFile } from '../lib/parsers/edsaParser';
import { parseColorFile } from '../lib/parsers/colorParser';
import { parseTarimaFile } from '../lib/parsers/tarimaParser';

const TEMPLATES_DIR = `${process.cwd()}/templates`;
mkdirSync(TEMPLATES_DIR, { recursive: true });

// Cargar los Excels reales como fuente de muestra
const edsaBuf = readFileSync(
  '/Users/fabrizzio/Downloads/Precios de producto EDSA- Extruidos 17 de abril de 2026.xlsx',
).buffer as ArrayBuffer;
const colorBuf = readFileSync(
  '/Users/fabrizzio/Downloads/Precios Color 21 Abril 2026.xlsx',
).buffer as ArrayBuffer;
const tarimaBuf = readFileSync(
  '/Users/fabrizzio/Documents/TRABAJO/BIONOVAPACK/05 OPERACION COMERCIAL - Novapack/Herramientas de Pricing y Cotizacion/Cantidad Producto por Tarima.xlsx',
).buffer as ArrayBuffer;

const edsaParsed = parseEDSAFile(edsaBuf);
const colorParsed = parseColorFile(colorBuf);
const tarimaParsed = parseTarimaFile(tarimaBuf);

console.log('Datos fuente:');
console.log(`  EDSA: ${edsaParsed.rows.length} filas`);
console.log(`  Color: ${colorParsed.rows.length} filas`);
console.log(`  Tarima: ${tarimaParsed.catalogo.length} SKUs, ${tarimaParsed.rangos.length} reglas`);
console.log('');

// === Helper para convertir filas a la forma plana del template ===

function flattenEDSA() {
  return edsaParsed.rows.map((r) => ({
    tipo_producto: r.product_type,
    ancho: r.ancho,
    calibres: r.calibres.filter((c) => c > 0).join(','),
    cono: r.cono,
    peso_neto: Number(r.peso_neto.toFixed(3)),
    peso_total: Number(r.peso_total.toFixed(3)),
    precio_mxn_kg: Number(r.precio_mxn_kg.toFixed(2)),
    fecha_vigencia: '2026-04-17',
    notas: '',
  }));
}

function flattenColor() {
  return colorParsed.rows.map((r) => ({
    tipo_resina: r.resin_class,
    tipo_color: r.color || '',
    tipo_producto: r.product_type,
    ancho: r.ancho,
    calibre: r.calibres[0] || 0,
    cono: r.cono,
    peso_neto: Number(r.peso_neto.toFixed(3)),
    peso_total: Number(r.peso_total.toFixed(3)),
    precio_mxn_kg: Number(r.precio_mxn_kg.toFixed(2)),
    master: r.master_mxn_kg !== undefined ? Number(r.master_mxn_kg.toFixed(2)) : '',
    intenso: r.intenso_mxn_kg !== undefined ? Number(r.intenso_mxn_kg.toFixed(2)) : '',
    fecha_vigencia: '2026-04-21',
    notas: '',
  }));
}

function flattenTarimaCatalogo() {
  return tarimaParsed.catalogo.map((c) => ({
    codigo_alterno: c.codigo_alterno ?? '',
    codigo_edsa: c.codigo_edsa ?? '',
    ancho: c.ancho,
    calibre: c.calibre,
    peso_neto: Number(c.peso_neto.toFixed(3)),
    peso_cono: c.peso_cono,
    peso_total: Number(c.peso_total.toFixed(3)),
    largo_real: c.largo_real !== null ? Number(c.largo_real.toFixed(0)) : '',
    largo_aprox: c.largo_aprox ?? '',
  }));
}

function flattenTarimaRangos() {
  return tarimaParsed.rangos.map((r) => ({
    ancho: r.ancho,
    peso_min: r.peso_min,
    peso_max: r.peso_max,
    pz_por_cama: r.pz_por_cama,
    camas_por_tarima: r.camas_por_tarima,
    total_rollos: r.total_rollos,
  }));
}

// === Helper para construir hoja README ===

function readmeSheet(lines: string[]): XLSX.WorkSheet {
  const data = lines.map((l) => [l]);
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 100 }]; // ancho de columna
  return ws;
}

// === Aplicar styling de header ===

function styleHeader(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  // Auto-width columnas basico
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

// === GENERAR Template EDSA ===

{
  const wb = XLSX.utils.book_new();

  const readme = readmeSheet([
    'TEMPLATE - Precios base EDSA / Extruidos',
    '',
    'Este es el formato limpio recomendado para la lista de precios de producto Manual,',
    'Semi/Auto, HP y Pre-estirado. Reemplaza las 17 hojas del archivo actual con UNA sola.',
    '',
    'COLUMNAS DE LA HOJA "Precios":',
    '',
    '  tipo_producto:    manual | semi | auto | auto_c50_semi_hp | hp300 | hp350 | preesti',
    '  ancho:            ancho del rollo en pulgadas (ej. 18, 19.7, 20)',
    '  calibres:         lista separada por coma de calibres aplicables (ej. "50,60,70,80")',
    '  cono:             peso del cono en kg (ej. 0.35, 0.44, 0.6, 0.8)',
    '  peso_neto:        peso neto del rollo en kg (PN)',
    '  peso_total:       peso total = PN + cono (PB)',
    '  precio_mxn_kg:    costo MXN por kg base (ej. 47.08 para virgen Manual)',
    '  fecha_vigencia:   fecha YYYY-MM-DD desde cuando aplica este precio',
    '  notas:            opcional, cualquier observacion',
    '',
    'CONOS DISPONIBLES POR CONVENCION:',
    '  Manual: 0.350, 0.400, 0.440, 0.500, 0.600, 0.800',
    '  Semi/Auto: 0.8, 1.0, 1.2, 1.4, 2.0',
    '  Pre-estirado: 0.35 - 0.8',
    '',
    'NOTAS:',
    '  - Si el precio aplica a un rango de calibres, listalos separados por coma',
    '  - Si aplica a TODOS los calibres, dejas calibres vacio',
    '  - El cotizador busca por (ancho, cono, peso_total) cuando consulta precios',
    '  - Las versiones anteriores se preservan en historial al subir un nuevo archivo',
    '',
    'Generado automaticamente desde el archivo real para que Diego vea el mapping.',
  ]);
  XLSX.utils.book_append_sheet(wb, readme, 'README');

  // Limitar a primeras 60 filas como ejemplo + agregar fila de placeholder
  const data = flattenEDSA();
  const sample = [
    {
      tipo_producto: 'manual',
      ancho: 18,
      calibres: '50,60,70,80',
      cono: 0.35,
      peso_neto: 2.96,
      peso_total: 3.31,
      precio_mxn_kg: 47.08,
      fecha_vigencia: '2026-04-17',
      notas: 'EJEMPLO — borra esta fila',
    },
    ...data.slice(0, 60),
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  styleHeader(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Precios');

  XLSX.writeFile(wb, `${TEMPLATES_DIR}/template_precios_EDSA.xlsx`);
  console.log(`✓ template_precios_EDSA.xlsx (${data.length + 1} filas de ejemplo)`);
}

// === GENERAR Template Color ===

{
  const wb = XLSX.utils.book_new();

  const readme = readmeSheet([
    'TEMPLATE - Precios Color / Reciclado-Virgen / Intenso',
    '',
    'Este es el formato limpio recomendado para la lista de precios con color, R-V,',
    'intenso y master. Reemplaza las 36 hojas del archivo actual con UNA sola.',
    '',
    'COLUMNAS DE LA HOJA "Precios":',
    '',
    '  tipo_resina:      virgen | reciclado | color',
    '  tipo_color:       clear | orange | black | blue | red | green | yellow | custom',
    '                    (vacio si tipo_resina es virgen o reciclado puro)',
    '  tipo_producto:    manual | semi | auto',
    '  ancho:            pulgadas (18, 20, 23.5)',
    '  calibre:          un solo calibre (a diferencia del template EDSA)',
    '  cono:             peso del cono en kg (0.3 - 2.0)',
    '  peso_neto:        PN del rollo (kg)',
    '  peso_total:       PB = PN + cono (kg)',
    '  precio_mxn_kg:    costo MXN por kg final',
    '  master:           costo del masterbatch en MXN/kg (ej. 1.5 para colores estandar)',
    '  intenso:          adder por pigmento intenso en MXN/kg (1.25 tipico)',
    '  fecha_vigencia:   YYYY-MM-DD',
    '  notas:            observaciones',
    '',
    'NOTAS:',
    '  - Una fila por cada combinacion (resina, color, producto, ancho, calibre, cono, PB)',
    '  - El campo color puede dejarse vacio para "color generico" (master se aplicara igual)',
    '  - El cotizador combina precio_mxn_kg + master automaticamente al cotizar',
    '',
    'Generado desde tu archivo real para mostrar la equivalencia.',
  ]);
  XLSX.utils.book_append_sheet(wb, readme, 'README');

  const data = flattenColor();
  const sample = [
    {
      tipo_resina: 'color',
      tipo_color: 'orange',
      tipo_producto: 'manual',
      ancho: 18,
      calibre: 80,
      cono: 0.6,
      peso_neto: 2.8,
      peso_total: 3.4,
      precio_mxn_kg: 35.65,
      master: 1.5,
      intenso: '',
      fecha_vigencia: '2026-04-21',
      notas: 'EJEMPLO — borra esta fila',
    },
    ...data.slice(0, 100),
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  styleHeader(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Precios');

  XLSX.writeFile(wb, `${TEMPLATES_DIR}/template_precios_color.xlsx`);
  console.log(`✓ template_precios_color.xlsx (${data.length + 1} filas)`);
}

// === GENERAR Template Tarima ===

{
  const wb = XLSX.utils.book_new();

  const readme = readmeSheet([
    'TEMPLATE - Cantidad por Tarima',
    '',
    'Este template tiene 2 hojas:',
    '',
    '  1. "Catalogo" — SKUs especificos (es la lista de productos historicamente fabricados)',
    '  2. "Reglas"   — rangos por (ancho, peso_total) → rollos por tarima',
    '',
    'TU FORMATO ACTUAL YA ES BASTANTE LIMPIO. Solo le quitamos columnas vacias',
    'y normalizamos los nombres de las hojas. Si quieres seguir con tu formato',
    'actual, no tienes que cambiar nada — el cotizador lo entiende.',
    '',
    'COLUMNAS DE "Catalogo":',
    '  codigo_alterno:  identificador comercial (ej. "18\\" 80 3.4 C600")',
    '  codigo_edsa:     codigo interno (opcional)',
    '  ancho:           pulgadas',
    '  calibre:         un solo calibre',
    '  peso_neto:       PN kg',
    '  peso_cono:       peso del cono kg',
    '  peso_total:      PN + cono',
    '  largo_real:      largo calculado en ft (opcional, para referencia)',
    '  largo_aprox:     largo redondeado para la etiqueta (ej. 1000)',
    '',
    'COLUMNAS DE "Reglas":',
    '  ancho:              pulgadas',
    '  peso_min:           PB minimo del rango (kg)',
    '  peso_max:           PB maximo del rango (kg)',
    '  pz_por_cama:        rollos por cama',
    '  camas_por_tarima:   numero de camas',
    '  total_rollos:       resultado = pz_por_cama × camas_por_tarima',
    '',
    'El cotizador usa "Catalogo" para sugerir conos historicos al vendedor,',
    'y "Reglas" para calcular cuantos rollos caben por tarima.',
  ]);
  XLSX.utils.book_append_sheet(wb, readme, 'README');

  const cat = flattenTarimaCatalogo();
  const wsCatalogo = XLSX.utils.json_to_sheet(cat.slice(0, 200));
  styleHeader(wsCatalogo);
  XLSX.utils.book_append_sheet(wb, wsCatalogo, 'Catalogo');

  const reg = flattenTarimaRangos();
  const wsReglas = XLSX.utils.json_to_sheet(reg);
  styleHeader(wsReglas);
  XLSX.utils.book_append_sheet(wb, wsReglas, 'Reglas');

  XLSX.writeFile(wb, `${TEMPLATES_DIR}/template_tarima.xlsx`);
  console.log(`✓ template_tarima.xlsx (${cat.length} SKUs + ${reg.length} reglas)`);
}

console.log(`\nTemplates generados en: ${TEMPLATES_DIR}`);
console.log('Diego puede:');
console.log('  1. Abrir cada uno y leer el README');
console.log('  2. Verificar que la hoja Precios/Catalogo tiene la informacion correcta');
console.log('  3. Usar el formato para sus proximos archivos (opcional)');
console.log('  4. Subirlos al cotizador en /cotizador/precios — funcionan igual que el formato legacy');
