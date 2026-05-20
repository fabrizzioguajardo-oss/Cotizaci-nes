// Precompila los Excels reales a un JSON estatico que la app carga al inicio.
// Output: public/data/precios.json
//
// Correr cuando Diego suba archivos nuevos:
//   npx tsx scripts/build-static-data.ts <path-edsa> <path-color> <path-tarima> [path-productos-edsa]
// productos-edsa es opcional — si no se pasa, se busca prductosEDSA.xlsx en Downloads.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { parseEDSAFile } from '../lib/parsers/edsaParser';
import { parseColorFile } from '../lib/parsers/colorParser';
import { parseTarimaFile } from '../lib/parsers/tarimaParser';
import { parseProductosEDSAFile } from '../lib/parsers/productosEDSAParser';

const args = process.argv.slice(2);
const edsaPath =
  args[0] ??
  '/Users/fabrizzio/Downloads/Precios de producto EDSA- Extruidos 17 de abril de 2026.xlsx';
const colorPath =
  args[1] ?? '/Users/fabrizzio/Downloads/Precios Color 21 Abril 2026.xlsx';
const tarimaPath =
  args[2] ??
  '/Users/fabrizzio/Documents/TRABAJO/BIONOVAPACK/05 OPERACION COMERCIAL - Novapack/Herramientas de Pricing y Cotizacion/Cantidad Producto por Tarima.xlsx';
const productosEDSAPath = args[3] ?? '/Users/fabrizzio/Downloads/prductosEDSA.xlsx';

console.log('Cargando archivos:');
console.log('  EDSA:           ', edsaPath);
console.log('  Color:          ', colorPath);
console.log('  Tarima:         ', tarimaPath);
console.log('  Productos EDSA: ', productosEDSAPath, existsSync(productosEDSAPath) ? '✓' : '(opcional, no encontrado)');

const edsaBuf = readFileSync(edsaPath).buffer as ArrayBuffer;
const colorBuf = readFileSync(colorPath).buffer as ArrayBuffer;
const tarimaBuf = readFileSync(tarimaPath).buffer as ArrayBuffer;

const edsa = parseEDSAFile(edsaBuf);
const color = parseColorFile(colorBuf);
const tarima = parseTarimaFile(tarimaBuf);

const productosEDSA = existsSync(productosEDSAPath)
  ? parseProductosEDSAFile(readFileSync(productosEDSAPath).buffer as ArrayBuffer)
  : { catalogo: [], warnings: [], sheetsProcessed: [], sheetsSkipped: [] };

const output = {
  generated_at: new Date().toISOString(),
  source_files: {
    edsa: edsaPath.split('/').pop(),
    color: colorPath.split('/').pop(),
    tarima: tarimaPath.split('/').pop(),
    productos_edsa: existsSync(productosEDSAPath) ? productosEDSAPath.split('/').pop() : undefined,
  },
  precios_edsa: edsa.rows,
  precios_color: color.rows,
  catalogo_tarima: tarima.catalogo,
  rangos_tarima: tarima.rangos,
  productos_edsa: productosEDSA.catalogo,
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
    productos_edsa_skus: productosEDSA.catalogo.length,
    productos_edsa_warnings: productosEDSA.warnings.length,
  },
};

const outPath = `${process.cwd()}/public/data/precios.json`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(output, null, 0));

console.log(`\n✓ Generado: ${outPath}`);
console.log(`  Tamaño: ${(JSON.stringify(output).length / 1024).toFixed(1)} KB`);
console.log(`  Stats:`, output.stats);
