// Parser de "Productos EDSA - Tabla Maestra".
// Distinto del archivo de PRECIOS EDSA — este es el catalogo MAESTRO de
// SKUs reales con ancho/calibre/cono/PB de cada producto que EDSA ya
// fabrica. Sirve como referencia adicional para sugerir conos cuando el
// archivo "Cantidad Producto por Tarima" (que filtra a un subconjunto)
// no tiene match para un (ancho, calibre) dado.
//
// Output: lista de ParsedTarimaRow (sin largo_real/largo_aprox porque la
// tabla maestra no los incluye). Se pluggea como segundo universo en
// `lookupConoOptions` antes de caer al universo de precios.
//
// Estructura esperada (sheet "tablaMestra_*"):
//   Row 0: headers [CÓDIGO, CÓDIGO ALTERNO, ANCHO, CALIBRE, PESO TOTAL,
//                   PESO CONO, USO, PROCESO, PESO ROLLO, PIEZAS POR TARIMA,
//                   CONO*/* ...marcadores...]
//   Row 1: unidades [null, null, (PLG), (GUAGES), (Kg), (Kg), null, null,
//                    NETO (Kg), null, ...]
//   Row 2+: datos

import * as XLSX from 'xlsx';
import type { ParsedTarimaRow } from './types';
import { num, str } from './utils';

export interface ProductosEDSAParseReport {
  catalogo: ParsedTarimaRow[];
  warnings: string[];
  sheetsProcessed: string[];
  sheetsSkipped: string[];
}

// Tolera el typo "tablaMestra" (sin "a") y variantes con sufijos numericos.
const SHEET_NAME_RE = /tabla\s*ma?estra/i;

export function parseProductosEDSAFile(buffer: ArrayBuffer): ProductosEDSAParseReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  const catalogo: ParsedTarimaRow[] = [];
  const warnings: string[] = [];
  const sheetsProcessed: string[] = [];
  const sheetsSkipped: string[] = [];

  for (const sheetName of wb.SheetNames) {
    if (!SHEET_NAME_RE.test(sheetName)) {
      sheetsSkipped.push(sheetName);
      continue;
    }

    const sheet = wb.Sheets[sheetName];
    const result = parseTablaMaestraSheet(sheet, sheetName);
    catalogo.push(...result.rows);
    warnings.push(...result.warnings);
    sheetsProcessed.push(sheetName);
  }

  if (sheetsProcessed.length === 0) {
    warnings.push('No encontre hoja con nombre "tablaMaestra" / "tablaMestra"');
  }

  return { catalogo, warnings, sheetsProcessed, sheetsSkipped };
}

function parseTablaMaestraSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
): { rows: ParsedTarimaRow[]; warnings: string[] } {
  const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });
  const rows: ParsedTarimaRow[] = [];
  const warnings: string[] = [];

  if (json.length < 3) {
    warnings.push(`${sheetName}: hoja muy corta (${json.length} filas)`);
    return { rows, warnings };
  }

  // Localizar columnas por header (defensivo por si cambia el orden).
  const headers = (json[0] ?? []).map((h) => (h == null ? '' : String(h).trim().toLowerCase()));
  const col = (re: RegExp): number => headers.findIndex((h) => re.test(h));

  const idxCodigo = col(/^c[oó]digo$/);
  const idxAlterno = col(/c[oó]digo\s*alterno/);
  const idxAncho = col(/^ancho$/);
  const idxCalibre = col(/^calibre$/);
  const idxPesoTotal = col(/peso\s*total/);
  const idxPesoCono = col(/peso\s*cono/);
  const idxPesoRollo = col(/peso\s*rollo|peso\s*neto/);

  if (idxAncho < 0 || idxCalibre < 0 || idxPesoTotal < 0 || idxPesoCono < 0) {
    warnings.push(
      `${sheetName}: faltan columnas requeridas (ancho=${idxAncho}, calibre=${idxCalibre}, pesoTotal=${idxPesoTotal}, pesoCono=${idxPesoCono})`,
    );
    return { rows, warnings };
  }

  // Row 1 son las unidades (descartar). Datos empiezan en row 2.
  for (let i = 2; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;

    const ancho = num(row[idxAncho]);
    const calibre = num(row[idxCalibre]);
    const pesoTotal = num(row[idxPesoTotal]);
    const pesoCono = num(row[idxPesoCono]);
    const pesoRollo = idxPesoRollo >= 0 ? num(row[idxPesoRollo]) : null;

    if (ancho === null || calibre === null || pesoTotal === null || pesoCono === null) continue;
    // Filtros de sanidad para descartar filas-headers repetidos / basura
    if (ancho <= 0 || ancho > 200) continue;
    if (calibre <= 0 || calibre > 1000) continue;
    if (pesoTotal <= 0 || pesoTotal > 100) continue;
    if (pesoCono < 0 || pesoCono > 50) continue;

    rows.push({
      codigo_edsa: idxCodigo >= 0 ? str(row[idxCodigo]) || null : null,
      codigo_alterno: idxAlterno >= 0 ? str(row[idxAlterno]) || null : null,
      ancho,
      calibre,
      peso_total: pesoTotal,
      peso_cono: pesoCono,
      peso_neto: pesoRollo ?? Math.max(0, pesoTotal - pesoCono),
      largo_real: null,
      largo_aprox: null,
      codigo_generado: null,
    });
  }

  return { rows, warnings };
}
