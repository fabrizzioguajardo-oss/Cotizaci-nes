// Parser del archivo "Cantidad Producto por Tarima.xlsx"
// Dos hojas:
//   "General" - rangos por ancho y peso total -> rollos por tarima
//   "Flitros" (typo del archivo, "Filtros") - catalogo SKU especifico

import * as XLSX from 'xlsx';
import type {
  ParsedTarimaRow,
  ParsedTarimaRange,
  TarimaParseReport,
} from './types';
import { num, str } from './utils';

function parseGeneralSheet(sheet: XLSX.WorkSheet): {
  rangos: ParsedTarimaRange[];
  warnings: string[];
} {
  const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });
  const rangos: ParsedTarimaRange[] = [];
  const warnings: string[] = [];

  // Primera fila = headers: ANCHO | PESO MIN | PESO MAX | PZ POR CAMA | CAMAS X TARIMA | TOTAL ROLLOS
  for (let i = 1; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;
    const ancho = num(row[0]);
    const pmin = num(row[1]);
    const pmax = num(row[2]);
    const pzCama = num(row[3]);
    const camas = num(row[4]);
    const total = num(row[5]);
    if (ancho === null || pmin === null || pmax === null || pzCama === null || camas === null) continue;
    rangos.push({
      ancho,
      peso_min: pmin,
      peso_max: pmax,
      pz_por_cama: pzCama,
      camas_por_tarima: camas,
      total_rollos: total ?? pzCama * camas,
    });
  }
  return { rangos, warnings };
}

function parseFiltrosSheet(sheet: XLSX.WorkSheet): {
  catalogo: ParsedTarimaRow[];
  warnings: string[];
} {
  const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });
  const catalogo: ParsedTarimaRow[] = [];
  const warnings: string[] = [];

  // Header en row 1: CÓDIGO EDSA | CÓDIGO ALTERNO | ANCHO | CALIBRE | PESO TOTAL | CODIGO GENERADO | PESO CONO | PESO NETO | LARGO REAL | LARGO APROX
  for (let i = 2; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;
    const codEdsa = str(row[0]);
    const codAlterno = str(row[1]);
    const ancho = num(row[2]);
    const calibre = num(row[3]);
    const pesoTotal = num(row[4]);
    const codGen = str(row[5]);
    const pesoCono = num(row[6]);
    const pesoNeto = num(row[7]);
    const largoReal = num(row[8]);
    const largoAprox = num(row[9]);

    if (ancho === null || calibre === null || pesoTotal === null) continue;

    catalogo.push({
      codigo_edsa: codEdsa || null,
      codigo_alterno: codAlterno || null,
      ancho,
      calibre,
      peso_total: pesoTotal,
      peso_cono: pesoCono ?? 0,
      peso_neto: pesoNeto ?? pesoTotal - (pesoCono ?? 0),
      largo_real: largoReal,
      largo_aprox: largoAprox,
      codigo_generado: codGen || null,
    });
  }
  return { catalogo, warnings };
}

export function parseTarimaFile(buffer: ArrayBuffer): TarimaParseReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  let catalogo: ParsedTarimaRow[] = [];
  let rangos: ParsedTarimaRange[] = [];
  const warnings: string[] = [];

  // "Flitros" es el typo del archivo original
  const filtrosSheet = wb.Sheets['Flitros'] ?? wb.Sheets['Filtros'];
  if (filtrosSheet) {
    const r = parseFiltrosSheet(filtrosSheet);
    catalogo = r.catalogo;
    warnings.push(...r.warnings);
  } else {
    warnings.push('No encontre hoja Flitros/Filtros');
  }

  const generalSheet = wb.Sheets['General'];
  if (generalSheet) {
    const r = parseGeneralSheet(generalSheet);
    rangos = r.rangos;
    warnings.push(...r.warnings);
  } else {
    warnings.push('No encontre hoja General');
  }

  return { catalogo, rangos, warnings };
}

// Helpers de busqueda

// Dado (ancho, peso_total) devuelve la regla de tarima aplicable
export function findTarimaRule(
  rangos: ParsedTarimaRange[],
  ancho: number,
  pesoTotal: number,
): ParsedTarimaRange | null {
  // Match exacto de ancho primero; si ese ancho no tiene reglas, tolerar SOLO
  // anchos cercanos (±1"). Antes el fallback era `: rangos` (TODOS los anchos),
  // así que un ancho sin reglas tomaba el acomodo de un ancho NO relacionado y
  // propagaba rollos/tarima equivocados sin avisar. Si ni el ancho exacto ni
  // los cercanos cubren el peso, devuelve null (el caller avisa "sin regla").
  const candidatos = rangos.filter((r) => r.ancho === ancho);
  const pool = candidatos.length > 0
    ? candidatos
    : rangos.filter((r) => Math.abs(r.ancho - ancho) <= 1);
  for (const r of pool) {
    if (pesoTotal >= r.peso_min && pesoTotal <= r.peso_max) return r;
  }
  return null;
}

// Dado (ancho, calibre, largo o PN) devuelve todos los SKUs del catalogo que
// matchean para sugerir conos disponibles.
// La estrategia: comparar PN (peso neto teorico) con peso_neto del catalogo
// con tolerancia razonable.
export function findCatalogMatches(
  catalogo: ParsedTarimaRow[],
  params: {
    ancho: number;
    calibre: number;
    pn?: number;        // PN teorico (kg)
    pnTolerance?: number;
  },
): ParsedTarimaRow[] {
  const { ancho, calibre, pn, pnTolerance = 0.15 } = params;
  let matches = catalogo.filter((c) => c.ancho === ancho && c.calibre === calibre);
  if (pn !== undefined) {
    matches = matches.filter((c) => Math.abs(c.peso_neto - pn) <= pnTolerance);
  }
  // Ordenar por cono ascendente (asi muestras opciones de cono incremental)
  matches.sort((a, b) => a.peso_cono - b.peso_cono);
  return matches;
}

// Conos unicos disponibles para un (ancho, calibre) - util para el dropdown
export function uniqueConosFor(
  catalogo: ParsedTarimaRow[],
  ancho: number,
  calibre: number,
): number[] {
  const set = new Set<number>();
  for (const c of catalogo) {
    if (c.ancho === ancho && c.calibre === calibre) set.add(c.peso_cono);
  }
  return Array.from(set).sort((a, b) => a - b);
}
