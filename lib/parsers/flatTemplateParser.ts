// Parser de los templates limpios (formato plano).
// Diego puede migrar a este formato cuando quiera. El parser legacy sigue
// funcionando para sus archivos actuales.
//
// Templates esperados:
//   - EDSA   → 1 hoja "Precios" con columnas estandar
//   - Color  → 1 hoja "Precios" con columnas (incluye color/master/intenso)
//   - Tarima → 2 hojas "Catalogo" y "Reglas"

import * as XLSX from 'xlsx';
import type {
  ParsedPriceRow,
  ParseReport,
  ParsedTarimaRow,
  ParsedTarimaRange,
  TarimaParseReport,
  ProductType,
  ResinClass,
} from './types';
import { num, str, findColumn } from './utils';

const PRODUCT_TYPES: ProductType[] = [
  'manual', 'semi', 'auto', 'auto_c50_semi_hp', 'hp300', 'hp350', 'preesti', 'special',
];
const RESIN_CLASSES: ResinClass[] = ['virgen', 'reciclado', 'color'];

function parseProductType(s: string): ProductType {
  const lower = s.toLowerCase().trim();
  return (PRODUCT_TYPES.find((p) => p === lower) as ProductType) ?? 'manual';
}

function parseResinClass(s: string): ResinClass {
  const lower = s.toLowerCase().trim();
  return (RESIN_CLASSES.find((r) => r === lower) as ResinClass) ?? 'virgen';
}

function parseCalibresList(s: string): number[] {
  if (!s) return [];
  return s
    .split(/[,;\s]+/)
    .map((x) => parseFloat(x))
    .filter((n) => Number.isFinite(n) && n > 0);
}

// === EDSA template parser ===

export function parseEDSATemplate(buffer: ArrayBuffer): ParseReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  const allRows: ParsedPriceRow[] = [];
  const warnings: string[] = [];
  const processed: string[] = [];

  // Buscar hoja "Precios" o la primera no-README
  const sheetName =
    wb.SheetNames.find((n) => /precios?/i.test(n)) ?? wb.SheetNames.find((n) => !/readme|leeme/i.test(n));
  if (!sheetName) {
    return { rows: [], warnings: ['No encontre hoja Precios'], sheetsProcessed: [], sheetsSkipped: [] };
  }
  processed.push(sheetName);

  const sheet = wb.Sheets[sheetName];
  const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (json.length < 2) return { rows: [], warnings: ['Hoja vacia'], sheetsProcessed: processed, sheetsSkipped: [] };

  const headers = json[0];
  const idxTipo = findColumn(headers, /tipo_producto|product_type|tipo/i);
  const idxAncho = findColumn(headers, /ancho/i);
  const idxCalibres = findColumn(headers, /calibres?|calibre/i);
  const idxCono = findColumn(headers, /^cono/i);
  const idxPN = findColumn(headers, /peso_neto|^pn$/i);
  const idxPB = findColumn(headers, /peso_total|^pb$/i);
  const idxPrecio = findColumn(headers, /precio_mxn_kg|precio.*kg|mxn.*kg/i);

  if (idxAncho < 0 || idxCono < 0 || idxPB < 0 || idxPrecio < 0) {
    return {
      rows: [],
      warnings: [`Faltan columnas requeridas: ancho, cono, peso_total, precio_mxn_kg`],
      sheetsProcessed: processed,
      sheetsSkipped: [],
    };
  }

  for (let i = 1; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;
    const ancho = num(row[idxAncho]);
    const cono = num(row[idxCono]);
    const pb = num(row[idxPB]);
    const precio = num(row[idxPrecio]);
    if (ancho === null || cono === null || pb === null || precio === null) continue;
    if (precio < 1 || precio > 500) continue;

    const calibres = idxCalibres >= 0 ? parseCalibresList(str(row[idxCalibres])) : [];
    const pn = idxPN >= 0 ? num(row[idxPN]) ?? pb - cono : pb - cono;
    const tipo = idxTipo >= 0 ? parseProductType(str(row[idxTipo])) : 'manual';

    allRows.push({
      source_file: 'edsa',
      source_sheet: sheetName,
      product_type: tipo,
      resin_class: 'virgen',
      color: null,
      ancho,
      calibres: calibres.length > 0 ? calibres : [0],
      cono,
      peso_neto: pn,
      peso_total: pb,
      precio_mxn_kg: precio,
      raw_description: `${ancho}" cono=${cono} PB=${pb}`,
    });
  }
  return { rows: allRows, warnings, sheetsProcessed: processed, sheetsSkipped: [] };
}

// === Color template parser ===

export function parseColorTemplate(buffer: ArrayBuffer): ParseReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  const allRows: ParsedPriceRow[] = [];
  const warnings: string[] = [];
  const processed: string[] = [];

  const sheetName =
    wb.SheetNames.find((n) => /precios?/i.test(n)) ?? wb.SheetNames.find((n) => !/readme|leeme/i.test(n));
  if (!sheetName) {
    return { rows: [], warnings: ['No encontre hoja Precios'], sheetsProcessed: [], sheetsSkipped: [] };
  }
  processed.push(sheetName);

  const sheet = wb.Sheets[sheetName];
  const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (json.length < 2) return { rows: [], warnings: ['Hoja vacia'], sheetsProcessed: processed, sheetsSkipped: [] };

  const headers = json[0];
  const idxResina = findColumn(headers, /tipo_resina|resin/i);
  const idxColor = findColumn(headers, /tipo_color|^color/i);
  const idxTipo = findColumn(headers, /tipo_producto|product_type/i);
  const idxAncho = findColumn(headers, /ancho/i);
  const idxCalibre = findColumn(headers, /calibre/i);
  const idxCono = findColumn(headers, /^cono/i);
  const idxPN = findColumn(headers, /peso_neto|^pn$/i);
  const idxPB = findColumn(headers, /peso_total|^pb$/i);
  const idxPrecio = findColumn(headers, /precio_mxn_kg|precio.*kg/i);
  const idxMaster = findColumn(headers, /^master$|master_kg/i);
  const idxIntenso = findColumn(headers, /^intenso/i);

  if (idxAncho < 0 || idxCono < 0 || idxPB < 0 || idxPrecio < 0) {
    return {
      rows: [],
      warnings: ['Faltan columnas requeridas'],
      sheetsProcessed: processed,
      sheetsSkipped: [],
    };
  }

  for (let i = 1; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;
    const ancho = num(row[idxAncho]);
    const cono = num(row[idxCono]);
    const pb = num(row[idxPB]);
    const precio = num(row[idxPrecio]);
    if (ancho === null || cono === null || pb === null || precio === null) continue;
    if (precio < 1 || precio > 500) continue;

    const calibre = idxCalibre >= 0 ? num(row[idxCalibre]) : null;
    const pn = idxPN >= 0 ? num(row[idxPN]) ?? pb - cono : pb - cono;
    const tipo = idxTipo >= 0 ? parseProductType(str(row[idxTipo])) : 'manual';
    const resin = idxResina >= 0 ? parseResinClass(str(row[idxResina])) : 'color';
    const color = idxColor >= 0 ? str(row[idxColor]) || null : null;
    const master = idxMaster >= 0 ? num(row[idxMaster]) ?? undefined : undefined;
    const intenso = idxIntenso >= 0 ? num(row[idxIntenso]) ?? undefined : undefined;

    allRows.push({
      source_file: 'color',
      source_sheet: sheetName,
      product_type: tipo,
      resin_class: resin,
      color,
      ancho,
      calibres: calibre !== null ? [calibre] : [0],
      cono,
      peso_neto: pn,
      peso_total: pb,
      precio_mxn_kg: precio,
      raw_description: `${ancho}" ${calibre ?? '?'}GA cono=${cono} PB=${pb}${color ? ` ${color}` : ''}`,
      master_mxn_kg: master,
      intenso_mxn_kg: intenso,
    });
  }
  return { rows: allRows, warnings, sheetsProcessed: processed, sheetsSkipped: [] };
}

// === Tarima template parser ===

export function parseTarimaTemplate(buffer: ArrayBuffer): TarimaParseReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  const warnings: string[] = [];

  // Hoja Catalogo
  const catSheetName = wb.SheetNames.find((n) => /catalogo|catálogo|filtros|skus?/i.test(n));
  let catalogo: ParsedTarimaRow[] = [];
  if (catSheetName) {
    const json: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[catSheetName], { header: 1, defval: null });
    if (json.length > 1) {
      const headers = json[0];
      const idxCodAlterno = findColumn(headers, /codigo_alterno|sku|código.*alterno/i);
      const idxCodEdsa = findColumn(headers, /codigo_edsa|código.*edsa/i);
      const idxAncho = findColumn(headers, /ancho/i);
      const idxCalibre = findColumn(headers, /calibre/i);
      const idxPN = findColumn(headers, /peso_neto|^pn/i);
      const idxCono = findColumn(headers, /peso_cono|^cono/i);
      const idxPB = findColumn(headers, /peso_total|^pb/i);
      const idxLargoReal = findColumn(headers, /largo_real/i);
      const idxLargoAprox = findColumn(headers, /largo_aprox/i);

      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (!row) continue;
        const ancho = num(row[idxAncho]);
        const calibre = num(row[idxCalibre]);
        const pb = num(row[idxPB]);
        if (ancho === null || calibre === null || pb === null) continue;
        catalogo.push({
          codigo_edsa: idxCodEdsa >= 0 ? str(row[idxCodEdsa]) || null : null,
          codigo_alterno: idxCodAlterno >= 0 ? str(row[idxCodAlterno]) || null : null,
          ancho,
          calibre,
          peso_total: pb,
          peso_cono: idxCono >= 0 ? num(row[idxCono]) ?? 0 : 0,
          peso_neto: idxPN >= 0 ? num(row[idxPN]) ?? pb - (idxCono >= 0 ? num(row[idxCono]) ?? 0 : 0) : pb,
          largo_real: idxLargoReal >= 0 ? num(row[idxLargoReal]) : null,
          largo_aprox: idxLargoAprox >= 0 ? num(row[idxLargoAprox]) : null,
          codigo_generado: null,
        });
      }
    }
  } else {
    warnings.push('No encontre hoja Catalogo/SKUs');
  }

  // Hoja Reglas
  const rulesSheetName = wb.SheetNames.find((n) => /reglas|general|rangos/i.test(n));
  let rangos: ParsedTarimaRange[] = [];
  if (rulesSheetName) {
    const json: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[rulesSheetName], { header: 1, defval: null });
    if (json.length > 1) {
      const headers = json[0];
      const idxAncho = findColumn(headers, /ancho/i);
      const idxPmin = findColumn(headers, /peso_min|peso\s*min/i);
      const idxPmax = findColumn(headers, /peso_max|peso\s*max/i);
      const idxPzCama = findColumn(headers, /pz_por_cama|pz.*cama|piezas/i);
      const idxCamas = findColumn(headers, /camas/i);
      const idxTotal = findColumn(headers, /total_rollos|total/i);

      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (!row) continue;
        const ancho = num(row[idxAncho]);
        const pmin = num(row[idxPmin]);
        const pmax = num(row[idxPmax]);
        const pzCama = num(row[idxPzCama]);
        const camas = num(row[idxCamas]);
        if (ancho === null || pmin === null || pmax === null || pzCama === null || camas === null) continue;
        rangos.push({
          ancho,
          peso_min: pmin,
          peso_max: pmax,
          pz_por_cama: pzCama,
          camas_por_tarima: camas,
          total_rollos: idxTotal >= 0 ? num(row[idxTotal]) ?? pzCama * camas : pzCama * camas,
        });
      }
    }
  } else {
    warnings.push('No encontre hoja Reglas/General');
  }

  return { catalogo, rangos, warnings };
}

// Detector heuristico: ¿este archivo es template limpio o legacy?
// Devuelve true si parece template (1 hoja Precios o 2 hojas Catalogo/Reglas).
export function isCleanTemplate(buffer: ArrayBuffer, kind: 'edsa' | 'color' | 'tarima'): boolean {
  const wb = XLSX.read(buffer, { type: 'array', bookSheets: true });
  const sheetNames = wb.SheetNames.map((n) => n.toLowerCase());

  if (kind === 'tarima') {
    return sheetNames.some((n) => /catalogo|catálogo/.test(n)) && sheetNames.some((n) => /reglas/.test(n));
  }
  // EDSA o Color: template tiene una hoja "Precios" (no las multi-hojas legacy)
  const hasPrecios = sheetNames.some((n) => /^precios?$/.test(n));
  const hasLegacy = sheetNames.some((n) => /cono\s+de|color\s+\d|reciclado.*virgen|hp\d/i.test(n));
  return hasPrecios && !hasLegacy;
}
