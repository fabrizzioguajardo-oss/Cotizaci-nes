import { parseEDSAFile } from '../lib/parsers/edsaParser';
import { readFileSync } from 'fs';

const buffer = readFileSync(
  '/Users/fabrizzio/Downloads/Precios de producto EDSA- Extruidos 17 de abril de 2026.xlsx',
).buffer as ArrayBuffer;
const report = parseEDSAFile(buffer);

console.log('Sheets processed:', report.sheetsProcessed);
console.log('Sheets skipped:', report.sheetsSkipped.map((s) => s.name));
console.log('Total rows:', report.rows.length);
console.log('Warnings:', report.warnings.length);
if (report.warnings.length > 0) {
  console.log('First 5 warnings:', report.warnings.slice(0, 5));
}
console.log('---');
const byType: Record<string, number> = {};
for (const r of report.rows) byType[r.product_type] = (byType[r.product_type] || 0) + 1;
console.log('By product_type:', byType);
console.log('---');
console.log('Sample MANUAL rows (first 5):');
report.rows
  .filter((r) => r.product_type === 'manual')
  .slice(0, 5)
  .forEach((r) =>
    console.log(
      `  ${r.ancho}" cal=[${r.calibres}] cono=${r.cono} PN=${r.peso_neto} PB=${r.peso_total} → ${r.precio_mxn_kg} MXN/kg [${r.source_sheet}]`,
    ),
  );
console.log('---');
console.log('Sample SEMI/AUTO rows (first 5):');
report.rows
  .filter((r) => r.product_type === 'semi' || r.product_type === 'auto')
  .slice(0, 5)
  .forEach((r) =>
    console.log(
      `  ${r.product_type}: ${r.ancho}" cal=[${r.calibres}] cono=${r.cono} PN=${r.peso_neto} PB=${r.peso_total} → ${r.precio_mxn_kg} MXN/kg`,
    ),
  );
console.log('---');
console.log('Sample PREESTI rows (first 3):');
report.rows
  .filter((r) => r.product_type === 'preesti')
  .slice(0, 3)
  .forEach((r) =>
    console.log(`  ${r.ancho}" cono=${r.cono} PN=${r.peso_neto} PB=${r.peso_total} → ${r.precio_mxn_kg}`),
  );

// Verificacion contra Level Packaging real (camion 5to abril)
console.log('\n=== Verificación caso real Level Packaging ===');

// Mostrar todas las filas con ancho=18 cono=0.6 manual
const cono06 = report.rows.filter((r) => r.ancho === 18 && r.cono === 0.6 && r.product_type === 'manual');
console.log(`Total rows ancho=18 cono=0.6 manual: ${cono06.length}`);
cono06.slice(0, 8).forEach((r) =>
  console.log(`  PN=${r.peso_neto.toFixed(2)} PB=${r.peso_total.toFixed(2)} → ${r.precio_mxn_kg.toFixed(2)} MXN/kg cal=[${r.calibres}]`),
);

// Match: Orange 18×120 cono 0.6 PB 3.4 → debe dar 47.08 base virgen
const target = report.rows.find(
  (r) =>
    r.product_type === 'manual' &&
    r.ancho === 18 &&
    r.cono === 0.6 &&
    Math.abs(r.peso_total - 3.4) < 0.06,
);
if (target) {
  console.log('  Match encontrado:', JSON.stringify(target, null, 2));
  console.log('  Esperado: 38.45 MXN/kg base — Actual:', target.precio_mxn_kg);
  console.log('  Match:', Math.abs(target.precio_mxn_kg - 38.45) < 0.05 || Math.abs(target.precio_mxn_kg - 47.08) < 0.05 ? '✓' : '✗');
} else {
  console.log('  ✗ NO encontrado - revisar parser');
}
