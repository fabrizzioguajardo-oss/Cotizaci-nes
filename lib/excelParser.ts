// Parser de los Excel de precios que Diego envía por correo.
// Soporta dos formatos: "Precios_de_producto_EDSA" (virgen+reciclado)
// y "Precios_Color" (con masterbatch).

import * as XLSX from 'xlsx';
import type { PrecioBase, ResinType, ColorType } from '@/types';

export interface ParsedPrecio extends Omit<PrecioBase, 'id' | 'created_at'> {
  rowIndex: number;
  warning?: string;
}

// Heurística para identificar columnas relevantes del Excel
// Diego usa diferentes encabezados en diferentes versiones - normalizar.
function findCol(headers: (string | undefined)[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toString().toLowerCase().trim();
    for (const p of patterns) {
      if (p.test(h)) return i;
    }
  }
  return -1;
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).replace(/[$,\s]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Extrae ancho y calibre de descripciones tipo "18 X 80" o "18\"x80GA"
function parseAnchoCalibre(s: string): { ancho: number | null; calibre: number | null } {
  const cleaned = s.replace(/[″"']/g, '').toLowerCase();
  const m = cleaned.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/);
  if (m) return { ancho: parseFloat(m[1]), calibre: parseFloat(m[2]) };
  return { ancho: null, calibre: null };
}

// Detecta el tipo de color por palabras clave en el header de la sheet o filas
function detectColor(s: string): ColorType {
  const lower = s.toLowerCase();
  if (/orange/.test(lower)) return 'orange';
  if (/black|negr/.test(lower)) return 'black';
  if (/blue|azul/.test(lower)) return 'blue';
  if (/red|rojo/.test(lower)) return 'red';
  if (/green|verde/.test(lower)) return 'green';
  if (/yellow|amaril/.test(lower)) return 'yellow';
  if (/clear|transp/.test(lower)) return 'clear';
  return 'clear';
}

export function parseExcelFile(buffer: ArrayBuffer): ParsedPrecio[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const today = new Date().toISOString().slice(0, 10);
  const result: ParsedPrecio[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
    });
    if (json.length < 2) continue;

    // Buscar fila de encabezados en las primeras 6 filas
    let headerRow = -1;
    let headers: (string | undefined)[] = [];
    for (let i = 0; i < Math.min(6, json.length); i++) {
      const row = (json[i] || []).map((v) =>
        typeof v === 'string' ? v.trim() : v != null ? String(v) : undefined,
      );
      // Heurística: la fila de header tiene "medida" o "ancho" o "precio"
      const joined = row.join(' ').toLowerCase();
      if (
        /medida|ancho|calibre|precio|virgen|reciclado/.test(joined) &&
        row.filter(Boolean).length >= 3
      ) {
        headerRow = i;
        headers = row;
        break;
      }
    }
    if (headerRow < 0) continue;

    const idxMedidas = findCol(headers, [/medida/, /producto/, /descrip/]);
    const idxAncho = findCol(headers, [/ancho/, /width/]);
    const idxCalibre = findCol(headers, [/calibre|gauge|ga\b/]);
    const idxNeto = findCol(headers, [/neto/, /pn\b/, /peso\s*neto/]);
    const idxCono = findCol(headers, [/cono|core/]);
    const idxPrecioV = findCol(headers, [/virg/, /precio\s*v/]);
    const idxPrecioR = findCol(headers, [/recicl/, /precio\s*r/]);
    const idxPrecioC = findCol(headers, [/color/, /master/]);

    const sheetIsColor = /color|master/i.test(sheetName);

    for (let i = headerRow + 1; i < json.length; i++) {
      const row = json[i] || [];
      const medidaStr = row[idxMedidas] != null ? String(row[idxMedidas]) : '';
      if (!medidaStr.trim()) continue;

      const { ancho: parsedA, calibre: parsedC } = parseAnchoCalibre(medidaStr);
      const ancho = idxAncho >= 0 ? parseNumber(row[idxAncho]) ?? parsedA : parsedA;
      const calibre = idxCalibre >= 0 ? parseNumber(row[idxCalibre]) ?? parsedC : parsedC;
      const neto = idxNeto >= 0 ? parseNumber(row[idxNeto]) : null;
      const cono = idxCono >= 0 ? parseNumber(row[idxCono]) : null;
      const precioV = idxPrecioV >= 0 ? parseNumber(row[idxPrecioV]) : null;
      const precioR = idxPrecioR >= 0 ? parseNumber(row[idxPrecioR]) : null;
      const precioC = idxPrecioC >= 0 ? parseNumber(row[idxPrecioC]) : null;

      const tipoColor = sheetIsColor ? detectColor(medidaStr + ' ' + sheetName) : null;

      const variants: Array<{ resina: ResinType; precio: number | null }> = [];
      if (precioV !== null) variants.push({ resina: 'virgen', precio: precioV });
      if (precioR !== null) variants.push({ resina: 'reciclado', precio: precioR });
      if (precioC !== null) variants.push({ resina: 'color', precio: precioC });

      // Si solo hay una columna de precio sin label específica, usar virgen
      if (variants.length === 0) {
        const numericCells = row
          .map((v, idx) => ({ v: parseNumber(v), idx }))
          .filter((c) => c.v !== null && c.idx !== idxAncho && c.idx !== idxCalibre &&
                          c.idx !== idxNeto && c.idx !== idxCono);
        if (numericCells.length > 0) {
          const last = numericCells[numericCells.length - 1];
          if (last.v !== null && last.v > 5 && last.v < 200) {
            variants.push({
              resina: sheetIsColor ? 'color' : 'virgen',
              precio: last.v,
            });
          }
        }
      }

      for (const variant of variants) {
        if (variant.precio === null || variant.precio <= 0) continue;
        result.push({
          rowIndex: i,
          tipo_resina: variant.resina,
          tipo_color: tipoColor,
          ancho_in: ancho,
          calibre_ga: calibre,
          peso_neto_kg: neto,
          cono_kg: cono,
          precio_mxn_kg: variant.precio,
          fecha_vigencia: today,
          subido_por: null,
          warning:
            ancho === null || calibre === null
              ? 'Ancho/calibre no detectados — revisar fila manualmente'
              : undefined,
        });
      }
    }
  }

  return result;
}
