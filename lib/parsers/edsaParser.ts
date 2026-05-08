// Parser del archivo "Precios de producto EDSA - Extruidos".
// Maneja las 3 variantes de hojas:
//   - "Prod. Manual con Cono de X.XXX" (Manual, una hoja por cono)
//   - "Producto Semi y Automatico" (multi-precio: Semi/Auto/HP300/HP350)
//   - "Producto pre-estirado" (Pre-estirado, Bombacho)
// Tambien soporta "Resumen unificado" como validacion.

import * as XLSX from 'xlsx';
import type {
  ParsedPriceRow,
  ParseReport,
  ProductType,
} from './types';
import {
  num,
  str,
  extractConoFromSheetName,
  parseProductDescription,
  findHeaderRow,
  findColumn,
} from './utils';

// Hoja Manual: una por peso de cono. Headers DIVIDIDOS en 2 filas:
//   Row N:    [null, null, null, null, null, "Impacto del ", "Diferencia", "Precio Actual"]
//   Row N+1:  ["PRODUCTOS MANUALES", "Peso neto", "Cono", "Peso Total", null, "Cono $", "por kg $"]
// Por eso busco "Precio Actual" en rango amplio y otras columnas en la fila principal.
function parseManualConeSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  conoFromName: number | null,
): { rows: ParsedPriceRow[]; warnings: string[] } {
  const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });
  const rows: ParsedPriceRow[] = [];
  const warnings: string[] = [];

  const headerIdx = findHeaderRow(json, [/peso\s*neto/, /cono/, /peso\s*total/]);
  if (headerIdx < 0) {
    warnings.push(`${sheetName}: no encontre headers (Peso neto/Cono/Peso Total)`);
    return { rows, warnings };
  }
  const headers = json[headerIdx];

  const idxDesc = 0;
  const idxPN = findColumn(headers, /peso\s*neto/);
  const idxCono = findColumn(headers, /^cono$/);
  const idxPB = findColumn(headers, /peso\s*total/);

  // "Precio Actual" puede estar en fila anterior (header en 2 filas)
  let idxPrecio = findColumn(headers, /precio\s*actual/);
  if (idxPrecio < 0) {
    for (let r = Math.max(0, headerIdx - 2); r < headerIdx; r++) {
      const candidate = findColumn(json[r] || [], /precio\s*actual/);
      if (candidate >= 0) {
        idxPrecio = candidate;
        break;
      }
    }
  }

  if (idxPN < 0 || idxPB < 0 || idxPrecio < 0) {
    warnings.push(`${sheetName}: faltan columnas requeridas (PN=${idxPN}, PB=${idxPB}, Precio=${idxPrecio})`);
    return { rows, warnings };
  }

  for (let i = headerIdx + 1; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;
    const desc = str(row[idxDesc]);
    const pn = num(row[idxPN]);
    const cono = num(row[idxCono]) ?? conoFromName;
    const pb = num(row[idxPB]);
    const precio = num(row[idxPrecio]);

    // Skip filas vacias o invalidas
    if (!desc || pn === null || pb === null || precio === null) continue;
    if (cono === null) continue;
    if (precio < 1 || precio > 500) continue; // sanity bounds

    const { ancho, calibres } = parseProductDescription(desc);
    if (ancho === null) {
      warnings.push(`${sheetName} fila ${i}: no pude parsear ancho de "${desc}"`);
      continue;
    }

    rows.push({
      source_file: 'edsa',
      source_sheet: sheetName,
      product_type: 'manual',
      resin_class: 'virgen', // Manual EDSA es virgen base; reciclado sale del archivo Color
      color: null,
      ancho,
      calibres: calibres.length > 0 ? calibres : [0], // 0 = unknown
      cono,
      peso_neto: pn,
      peso_total: pb,
      precio_mxn_kg: precio,
      raw_description: desc,
    });
  }

  return { rows, warnings };
}

// Hoja Semi/Auto: tiene multi-columnas de precio (Semi, Auto, HP300, HP350...)
// Estructura por bloques: "Con cono de X" → filas con multi-precios
function parseSemiAutoSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
): { rows: ParsedPriceRow[]; warnings: string[] } {
  const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });
  const rows: ParsedPriceRow[] = [];
  const warnings: string[] = [];

  // Header esta en row 0 segun el archivo real
  const headerIdx = findHeaderRow(json, [/peso\s*neto/, /precio.*semi|auto|hp/i]);
  if (headerIdx < 0) {
    warnings.push(`${sheetName}: no encontre headers`);
    return { rows, warnings };
  }
  const headers = json[headerIdx];

  const idxDesc = 0;
  const idxPN = findColumn(headers, /peso\s*neto/);
  const idxCono = findColumn(headers, /^cono$/);
  const idxPB = findColumn(headers, /peso\s*total/);

  // Multi columnas de precio - cada una mapea a un product_type distinto
  const priceColMap: Array<{ pattern: RegExp; type: ProductType; label: string }> = [
    { pattern: /precio\s*actual\s*semi$/i, type: 'semi', label: 'Semi' },
    { pattern: /^auto.*c?60.*70.*80/i, type: 'auto', label: 'Auto C60-80+' },
    { pattern: /^auto.*c?50.*semi.*hp/i, type: 'auto_c50_semi_hp', label: 'Auto C50- y Semi HP' },
    { pattern: /^hp\s*300/i, type: 'hp300', label: 'HP300' },
    { pattern: /^hp\s*350/i, type: 'hp350', label: 'HP350' },
  ];
  const priceCols = priceColMap
    .map(({ pattern, type, label }) => ({ idx: findColumn(headers, pattern), type, label }))
    .filter((p) => p.idx >= 0);

  if (priceCols.length === 0) {
    warnings.push(`${sheetName}: no encontre columnas de precio`);
    return { rows, warnings };
  }

  let currentCono: number | null = null;
  for (let i = headerIdx + 1; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;
    const desc = str(row[idxDesc]).toLowerCase();

    // Detectar banderas "Con cono de X"
    if (desc.includes('con cono')) {
      const conoVal = num(row[idxCono]);
      if (conoVal !== null) currentCono = conoVal;
      continue;
    }

    const pn = num(row[idxPN]);
    const cono = num(row[idxCono]) ?? currentCono;
    const pb = num(row[idxPB]);

    if (!str(row[idxDesc]) || pn === null || pb === null || cono === null) continue;

    const { ancho, calibres } = parseProductDescription(str(row[idxDesc]));
    if (ancho === null) continue;

    // Una fila genera N entries (una por cada columna de precio)
    for (const pc of priceCols) {
      const precio = num(row[pc.idx]);
      if (precio === null || precio < 1 || precio > 500) continue;
      rows.push({
        source_file: 'edsa',
        source_sheet: sheetName,
        product_type: pc.type,
        resin_class: 'virgen',
        color: null,
        ancho,
        calibres: calibres.length > 0 ? calibres : [0],
        cono,
        peso_neto: pn,
        peso_total: pb,
        precio_mxn_kg: precio,
        raw_description: str(row[idxDesc]),
      });
    }
  }

  return { rows, warnings };
}

// Hoja Pre-estirado: similar a Manual pero con sub-secciones por cono
function parsePreestiradoSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
): { rows: ParsedPriceRow[]; warnings: string[] } {
  const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });
  const rows: ParsedPriceRow[] = [];
  const warnings: string[] = [];

  const headerIdx = findHeaderRow(json, [/peso\s*neto/, /pre.?estirado/i]);
  if (headerIdx < 0) {
    warnings.push(`${sheetName}: no encontre headers`);
    return { rows, warnings };
  }
  const headers = json[headerIdx];

  const idxDesc = 0;
  const idxPN = findColumn(headers, /peso\s*neto/);
  const idxCono = findColumn(headers, /^cono$/);
  const idxPB = findColumn(headers, /peso\s*total/);
  const idxPrecio = findColumn(headers, /pre.?estirado/i);

  if (idxPN < 0 || idxPrecio < 0) {
    warnings.push(`${sheetName}: faltan columnas`);
    return { rows, warnings };
  }

  let currentCono: number | null = null;
  for (let i = headerIdx + 1; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;
    const desc = str(row[idxDesc]);

    // Sub-secciones por cono - el cono aparece solo en col cono cuando hay una sub-sección
    if (!desc) {
      const conoVal = num(row[idxCono]);
      if (conoVal !== null && conoVal > 0 && conoVal < 5) {
        currentCono = conoVal;
      }
    }

    const pn = num(row[idxPN]);
    const cono = num(row[idxCono]) ?? currentCono;
    const pb = num(row[idxPB]);
    const precio = num(row[idxPrecio]);

    if (pn === null || pb === null || precio === null || cono === null) continue;
    if (precio < 1 || precio > 500) continue;

    rows.push({
      source_file: 'edsa',
      source_sheet: sheetName,
      product_type: 'preesti',
      resin_class: 'virgen',
      color: null,
      ancho: 18, // pre-estirado por convención es ancho 18 (Bombacho típico)
      calibres: [0],
      cono,
      peso_neto: pn,
      peso_total: pb,
      precio_mxn_kg: precio,
      raw_description: desc || 'Pre-estirado',
    });
  }

  return { rows, warnings };
}

// Entry point: parsea el workbook completo
export function parseEDSAFile(buffer: ArrayBuffer): ParseReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  const allRows: ParsedPriceRow[] = [];
  const allWarnings: string[] = [];
  const processed: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const lower = sheetName.toLowerCase();

    // Hoja Manual con cono especifico en el nombre
    if (lower.includes('cono de')) {
      const conoFromName = extractConoFromSheetName(sheetName);
      const { rows, warnings } = parseManualConeSheet(sheet, sheetName, conoFromName);
      allRows.push(...rows);
      allWarnings.push(...warnings);
      processed.push(sheetName);
      continue;
    }

    // Hoja Semi/Auto
    if (/semi.*auto/i.test(sheetName)) {
      const { rows, warnings } = parseSemiAutoSheet(sheet, sheetName);
      allRows.push(...rows);
      allWarnings.push(...warnings);
      processed.push(sheetName);
      continue;
    }

    // Hoja Pre-estirado
    if (/pre.?estirado/i.test(sheetName)) {
      const { rows, warnings } = parsePreestiradoSheet(sheet, sheetName);
      allRows.push(...rows);
      allWarnings.push(...warnings);
      processed.push(sheetName);
      continue;
    }

    // Hojas que no parseamos en este pass
    skipped.push({
      name: sheetName,
      reason: 'no es Manual/Semi/Auto/Pre-estirado',
    });
  }

  return {
    rows: allRows,
    warnings: allWarnings,
    sheetsProcessed: processed,
    sheetsSkipped: skipped,
  };
}
