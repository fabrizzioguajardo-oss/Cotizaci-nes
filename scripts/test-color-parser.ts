import { parseColorFile } from '../lib/parsers/colorParser';
import { readFileSync } from 'fs';

const buffer = readFileSync(
  '/Users/fabrizzio/Downloads/Precios Color 21 Abril 2026.xlsx',
).buffer as ArrayBuffer;
const report = parseColorFile(buffer);

console.log('Sheets processed:', report.sheetsProcessed.length);
console.log('Sheets skipped:', report.sheetsSkipped);
console.log('Total rows:', report.rows.length);
console.log('Warnings:', report.warnings.length);
if (report.warnings.length) console.log('First 5:', report.warnings.slice(0, 5));
console.log('---');
const byClass: Record<string, number> = {};
for (const r of report.rows) byClass[r.resin_class] = (byClass[r.resin_class] || 0) + 1;
console.log('By resin_class:', byClass);
const byType: Record<string, number> = {};
for (const r of report.rows) byType[r.product_type] = (byType[r.product_type] || 0) + 1;
console.log('By product_type:', byType);
console.log('---');
console.log('Sample COLOR rows (first 5):');
report.rows
  .filter((r) => r.resin_class === 'color')
  .slice(0, 5)
  .forEach((r) =>
    console.log(
      `  ${r.ancho}" cal=${r.calibres[0]} cono=${r.cono} PB=${r.peso_total} → ${r.precio_mxn_kg.toFixed(2)} MXN/kg ${r.intenso_mxn_kg ? '(intenso)' : ''} master=${r.master_mxn_kg ?? '?'} [${r.source_sheet}]`,
    ),
  );

// Buscar exact match para Level Packaging Orange 18×120 cono 0.6 PB 3.4
console.log('\n=== Buscar 18×120 cono 0.6 PB ~3.4 ===');
const matches = report.rows.filter(
  (r) => r.ancho === 18 && r.calibres[0] === 120 && r.cono === 0.6 && Math.abs(r.peso_total - 3.4) < 0.06,
);
console.log(`Matches: ${matches.length}`);
matches.forEach((r) => {
  console.log(
    `  ${r.resin_class} ${r.intenso_mxn_kg ? '(intenso)' : ''}: ${r.precio_mxn_kg.toFixed(2)} MXN/kg [${r.source_sheet}]`,
  );
});
