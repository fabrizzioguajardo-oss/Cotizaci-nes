// Utilidades compartidas por los parsers de Excel.

// Convierte cualquier celda a numero o null
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[$,\s]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Convierte cualquier celda a string limpio
export function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

// Extrae el peso del cono del nombre de la hoja (EDSA).
// Ej: "Prod. Manual con Cono de 0.350" -> 0.350
export function extractConoFromSheetName(name: string): number | null {
  const m = name.match(/(?:cono\s+de\s+|cono\s+)(\d+(?:[.,]\d+)?)/i);
  if (m) return parseFloat(m[1].replace(',', '.'));
  return null;
}

// Parsea descripcion tipo "18 C40, 45, " o "20 C50, 45, " o "20\" C80"
// Devuelve { ancho, calibres } donde calibres es un array de numeros.
export function parseProductDescription(desc: string): {
  ancho: number | null;
  calibres: number[];
} {
  if (!desc) return { ancho: null, calibres: [] };
  const cleaned = desc.replace(/[″"']/g, ' ').toLowerCase();

  // Ancho: primer numero
  const anchoMatch = cleaned.match(/^\s*(\d+(?:\.\d+)?)/);
  const ancho = anchoMatch ? parseFloat(anchoMatch[1]) : null;

  // Calibres: despues de "c" puede venir lista separada por coma o espacio
  // Ej: "c50, 60 70 80" -> [50, 60, 70, 80]
  const cMatch = cleaned.match(/c\s*([\d\s,.]+)/i);
  const calibres: number[] = [];
  if (cMatch) {
    const calStr = cMatch[1];
    const matches = calStr.matchAll(/(\d+(?:\.\d+)?)/g);
    for (const m of matches) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n) && n > 10 && n < 500) {
        calibres.push(n);
      }
    }
  }

  return { ancho, calibres };
}

// Encuentra el indice de fila donde estan los headers que matchean los patterns dados.
// Retorna -1 si no encuentra.
export function findHeaderRow(
  rows: unknown[][],
  patterns: RegExp[],
  maxRows = 10,
): number {
  for (let i = 0; i < Math.min(maxRows, rows.length); i++) {
    const row = rows[i] || [];
    const joined = row.map(str).join(' ').toLowerCase();
    if (patterns.every((p) => p.test(joined))) {
      return i;
    }
  }
  return -1;
}

// Encuentra el indice de columna que matchea un pattern en una fila de header.
export function findColumn(headers: unknown[], pattern: RegExp): number {
  for (let i = 0; i < headers.length; i++) {
    const h = str(headers[i]).toLowerCase();
    if (pattern.test(h)) return i;
  }
  return -1;
}

// Heuristica para saber si una fila es "data" (tiene numero en primera columna o ancho).
export function looksLikeDataRow(row: unknown[]): boolean {
  if (!row || row.length < 3) return false;
  const filled = row.filter((v) => v !== null && v !== '').length;
  return filled >= 3;
}
