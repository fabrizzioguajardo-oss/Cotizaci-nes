// Parser del archivo "Precios Color".
// Cada hoja se nombra por peso de cono (× 100 o × 1000):
//   "Color 300" -> cono 0.300 kg
//   "Color 600" -> cono 0.600
//   "Color 20 C 2.0" -> ancho 20, cono 2.0
// Variantes:
//   "Reciclado Virgen XXX" - R-V mix sin color
//   "Color XXX"            - color puro
//   "Color R-V XXX"        - color con mix R-V
//   "Color Semi/Auto X.X"  - producto semi/auto

import * as XLSX from 'xlsx';
import type { ParsedPriceRow, ParseReport, ProductType } from './types';
import { num, str, findHeaderRow, findColumn } from './utils';

// "300" -> 0.300, "440" -> 0.44, "1.0" -> 1.0, "2.0" -> 2.0
function parseConoFromSheetName(name: string): number | null {
  const cleaned = name.toLowerCase().trim();

  // Caso "X.X" (ya en kg): "1.0", "1.4", "2.0"
  const decimal = cleaned.match(/(\d+\.\d+)\s*$/);
  if (decimal) return parseFloat(decimal[1]);

  // Caso entero: "300" -> 0.300, "440" -> 0.44, "800" -> 0.8
  const intMatch = cleaned.match(/(\d{3,4})\s*$/);
  if (intMatch) {
    const n = parseInt(intMatch[1], 10);
    if (n >= 100 && n <= 1000) return n / 1000;
  }
  return null;
}

// "18 80 3.4" -> { ancho: 18, calibre: 80, pb: 3.4 }
function parseMedidas(medidas: string): {
  ancho: number | null;
  calibre: number | null;
  pb: number | null;
} {
  if (!medidas) return { ancho: null, calibre: null, pb: null };
  const cleaned = medidas.replace(/[″"']/g, ' ').trim();
  const nums = cleaned.match(/(\d+(?:\.\d+)?)/g);
  if (!nums || nums.length < 2) return { ancho: null, calibre: null, pb: null };
  return {
    ancho: parseFloat(nums[0]),
    calibre: parseFloat(nums[1]),
    pb: nums[2] ? parseFloat(nums[2]) : null,
  };
}

// Detecta tipo de producto de la hoja
function detectProductType(sheetName: string): ProductType {
  const lower = sheetName.toLowerCase();
  if (/auto/.test(lower)) return 'auto';
  if (/semi/.test(lower)) return 'semi';
  return 'manual';
}

// Detecta si es color puro o R-V (sin color especifico)
function detectResinClass(sheetName: string, firstColValue: string): 'color' | 'reciclado' | 'virgen' {
  const lower = sheetName.toLowerCase();
  const firstCol = (firstColValue || '').toLowerCase();
  // Si la fila empieza con "color", es color
  if (firstCol === 'color') return 'color';
  // "Reciclado Virgen XXX" sin "Color" en el nombre = R-V
  if (lower.includes('color')) return 'color';
  return 'reciclado';
}

interface ColorSheetHeader {
  reciclado_base: number | null;
  virgen_base: number | null;
  master: number | null;
  core_costo: number | null;
  intenso: number | null;
}

// Extrae los costos base de las primeras 2 filas del header
function parseColorHeader(rows: unknown[][]): ColorSheetHeader {
  const result: ColorSheetHeader = {
    reciclado_base: null,
    virgen_base: null,
    master: null,
    core_costo: null,
    intenso: null,
  };

  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const row = rows[i] || [];
    for (let j = 0; j < row.length - 1; j++) {
      const label = str(row[j]).toLowerCase();
      const value = num(row[j + 1]);
      if (value === null) continue;
      if (/reciclado\s*$/.test(label) && result.reciclado_base === null) result.reciclado_base = value;
      if (/virgen/.test(label)) result.virgen_base = value;
      if (/master/.test(label)) result.master = value;
      if (/core/.test(label)) result.core_costo = value;
      if (/intenso|porcentaje/.test(label) && result.intenso === null) result.intenso = value;
    }
  }
  return result;
}

function parseColorSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
): { rows: ParsedPriceRow[]; warnings: string[] } {
  const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });
  const rows: ParsedPriceRow[] = [];
  const warnings: string[] = [];

  const conoFromName = parseConoFromSheetName(sheetName);
  if (conoFromName === null) {
    warnings.push(`${sheetName}: no pude detectar cono del nombre`);
    return { rows, warnings };
  }

  const header = parseColorHeader(json);
  const productType = detectProductType(sheetName);

  // Header de columnas tipo "Color | Medidas | Neto | Core | Peso T | Imp. Core | Diferencia | P. Reciclado | P. Virgen | Intenso Recic | Intenso Virgen"
  const headerIdx = findHeaderRow(json, [/medidas/, /neto/, /core/, /peso\s*t/]);
  if (headerIdx < 0) {
    warnings.push(`${sheetName}: no encontre fila de columnas (Medidas/Neto/Core/Peso T)`);
    return { rows, warnings };
  }
  const colHeaders = json[headerIdx];

  const idxColorTipo = findColumn(colHeaders, /^color/);
  const idxMedidas = findColumn(colHeaders, /medida/);
  const idxNeto = findColumn(colHeaders, /^neto\s*$/);
  const idxCore = findColumn(colHeaders, /^core\s*$/);
  const idxPesoT = findColumn(colHeaders, /^peso\s*t/);
  const idxPRecic = findColumn(colHeaders, /^p\.\s*reciclado|p reciclado/i);
  const idxPVirgen = findColumn(colHeaders, /^p\.\s*virgen|p virgen/i);
  const idxIntensoRecic = findColumn(colHeaders, /intenso.*reciclado/i);
  const idxIntensoVirgen = findColumn(colHeaders, /intenso.*virgen/i);

  if (idxMedidas < 0 || idxPesoT < 0) {
    warnings.push(`${sheetName}: faltan columnas Medidas/PesoT`);
    return { rows, warnings };
  }

  for (let i = headerIdx + 1; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;

    const tipoColor = str(row[idxColorTipo]);
    const medidas = str(row[idxMedidas]);
    if (!medidas) continue;

    const { ancho, calibre, pb: pbFromMedidas } = parseMedidas(medidas);
    if (ancho === null || calibre === null) continue;

    const pn = num(row[idxNeto]);
    const cono = num(row[idxCore]) ?? conoFromName;
    const pb = num(row[idxPesoT]) ?? pbFromMedidas;

    if (pn === null || pb === null) continue;

    const isColor = /color/i.test(tipoColor);
    const baseClass = isColor ? 'color' : 'reciclado';

    // Generar filas para cada columna de precio relevante
    const variants: Array<{
      idx: number;
      resin_class: 'reciclado' | 'virgen' | 'color';
      intenso?: boolean;
    }> = [];

    if (idxPRecic >= 0) variants.push({ idx: idxPRecic, resin_class: isColor ? 'color' : 'reciclado' });
    if (idxPVirgen >= 0) variants.push({ idx: idxPVirgen, resin_class: isColor ? 'color' : 'virgen' });
    if (idxIntensoRecic >= 0) variants.push({ idx: idxIntensoRecic, resin_class: isColor ? 'color' : 'reciclado', intenso: true });
    if (idxIntensoVirgen >= 0) variants.push({ idx: idxIntensoVirgen, resin_class: isColor ? 'color' : 'virgen', intenso: true });

    for (const v of variants) {
      const precio = num(row[v.idx]);
      if (precio === null || precio < 1 || precio > 500) continue;

      rows.push({
        source_file: 'color',
        source_sheet: sheetName,
        product_type: productType,
        resin_class: v.resin_class,
        color: isColor ? 'generic' : null, // el color real lo elige el vendedor; este Excel da costo base
        ancho,
        calibres: [calibre],
        cono,
        peso_neto: pn,
        peso_total: pb,
        precio_mxn_kg: precio,
        raw_description: medidas,
        master_mxn_kg: header.master ?? undefined,
        intenso_mxn_kg: v.intenso ? header.intenso ?? undefined : undefined,
      });
    }
  }

  return { rows, warnings };
}

export function parseColorFile(buffer: ArrayBuffer): ParseReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  const allRows: ParsedPriceRow[] = [];
  const allWarnings: string[] = [];
  const processed: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const lower = sheetName.toLowerCase().trim();

    // Skip hojas que no son de precios
    if (lower === 'hoja1' || lower.includes('resumen')) {
      skipped.push({ name: sheetName, reason: 'hoja auxiliar' });
      continue;
    }

    const cono = parseConoFromSheetName(sheetName);
    if (cono === null) {
      skipped.push({ name: sheetName, reason: 'no pude detectar cono del nombre' });
      continue;
    }

    const { rows, warnings } = parseColorSheet(sheet, sheetName);
    allRows.push(...rows);
    allWarnings.push(...warnings);
    processed.push(sheetName);
  }

  return {
    rows: allRows,
    warnings: allWarnings,
    sheetsProcessed: processed,
    sheetsSkipped: skipped,
  };
}
