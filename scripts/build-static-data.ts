// Precompila los 3 Excels reales a un JSON estatico que la app carga al inicio.
// Output: public/data/precios.json
//
// Correr cuando Diego suba archivos nuevos:
//   npx tsx scripts/build-static-data.ts <path-edsa> <path-color> <path-tarima>

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { parseEDSAFile } from '../lib/parsers/edsaParser';
import { parseColorFile } from '../lib/parsers/colorParser';
import { parseTarimaFile } from '../lib/parsers/tarimaParser';

const args = process.argv.slice(2);
const edsaPath =
  args[0] ??
  '/Users/fabrizzio/Downloads/Precios de producto EDSA- Extruidos 17 de abril de 2026.xlsx';
const colorPath =
  args[1] ?? '/Users/fabrizzio/Downloads/Precios Color 21 Abril 2026.xlsx';
const tarimaPath =
  args[2] ??
  '/Users/fabrizzio/Documents/TRABAJO/BIONOVAPACK/05 OPERACION COMERCIAL - Novapack/Herramientas de Pricing y Cotizacion/Cantidad Producto por Tarima.xlsx';

console.log('Cargando archivos:');
console.log('  EDSA:  ', edsaPath);
console.log('  Color: ', colorPath);
console.log('  Tarima:', tarimaPath);

const edsaBuf = readFileSync(edsaPath).buffer as ArrayBuffer;
const colorBuf = readFileSync(colorPath).buffer as ArrayBuffer;
const tarimaBuf = readFileSync(tarimaPath).buffer as ArrayBuffer;

const edsa = parseEDSAFile(edsaBuf);
const color = parseColorFile(colorBuf);
const tarima = parseTarimaFile(tarimaBuf);

const output = {
  generated_at: new Date().toISOString(),
  source_files: {
    edsa: edsaPath.split('/').pop(),
    color: colorPath.split('/').pop(),
    tarima: tarimaPath.split('/').pop(),
  },
  precios_edsa: edsa.rows,
  precios_color: color.rows,
  catalogo_tarima: tarima.catalogo,
  rangos_tarima: tarima.rangos,
  stats: {
    edsa_rows: edsa.rows.length,
    edsa_warnings: edsa.warnings.length,
    edsa_sheets_processed: edsa.sheetsProcessed.length,
    edsa_sheets_skipped: edsa.sheetsSkipped.length,
    color_rows: color.rows.length,
    color_warnings: color.warnings.length,
    color_sheets_processed: color.sheetsProcessed.length,
    tarima_skus: tarima.catalogo.length,
    tarima_rangos: tarima.rangos.length,
  },
};

const outPath = `${process.cwd()}/public/data/precios.json`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(output, null, 0));

console.log(`\n✓ Generado: ${outPath}`);
console.log(`  Tamaño: ${(JSON.stringify(output).length / 1024).toFixed(1)} KB`);
console.log(`  Stats:`, output.stats);
