import {
  parseTarimaFile,
  findCatalogMatches,
  findTarimaRule,
  uniqueConosFor,
} from '../lib/parsers/tarimaParser';
import { readFileSync } from 'fs';
import { calcPN } from '../lib/pricingEngine';

const buffer = readFileSync(
  '/Users/fabrizzio/Documents/TRABAJO/BIONOVAPACK/05 OPERACION COMERCIAL - Novapack/Herramientas de Pricing y Cotizacion/Cantidad Producto por Tarima.xlsx',
).buffer as ArrayBuffer;
const report = parseTarimaFile(buffer);

console.log('Catalogo SKUs:', report.catalogo.length);
console.log('Rangos tarima:', report.rangos.length);
console.log('Warnings:', report.warnings);
console.log('---');
console.log('Sample rangos:');
report.rangos.slice(0, 6).forEach((r) =>
  console.log(`  ancho=${r.ancho}" PB ${r.peso_min}-${r.peso_max}kg → ${r.pz_por_cama}/cama × ${r.camas_por_tarima} camas = ${r.total_rollos} rollos/tarima`),
);
console.log('---');
console.log('Conos únicos disponibles para 18×80GA:');
console.log(' ', uniqueConosFor(report.catalogo, 18, 80));
console.log('Conos únicos disponibles para 18×120GA:');
console.log(' ', uniqueConosFor(report.catalogo, 18, 120));
console.log('---');

// Test caso real: Level Packaging Orange 18×120GA×715ft
console.log('\n=== Caso real: 18×120GA×715ft (Level Packaging Orange) ===');
const ancho = 18, calibre = 120, largo = 715;
const pn = calcPN(ancho, largo, calibre);
console.log(`PN teórico: ${pn.toFixed(3)} kg`);

const matches = findCatalogMatches(report.catalogo, { ancho, calibre, pn, pnTolerance: 0.15 });
console.log(`\nSKUs en catálogo (PN ≈ ${pn.toFixed(2)} kg):`);
matches.forEach((m) =>
  console.log(`  ${m.codigo_alterno} | cono=${m.peso_cono} | PN=${m.peso_neto} | PB=${m.peso_total} | largo aprox=${m.largo_aprox}`),
);

console.log('\n=== Reglas de tarima por cono ===');
matches.forEach((m) => {
  const rule = findTarimaRule(report.rangos, m.ancho, m.peso_total);
  if (rule) {
    console.log(`  cono ${m.peso_cono} (PB ${m.peso_total}) → ${rule.total_rollos} rollos/tarima (${rule.pz_por_cama}/cama × ${rule.camas_por_tarima} camas)`);
  }
});

// Verificar caso: 18×75GA×1000ft (lo que el user mencionó como ejemplo)
console.log('\n=== Caso ejemplo: 18×75GA×1000ft ===');
const pn2 = calcPN(18, 1000, 75);
console.log(`PN teórico: ${pn2.toFixed(3)} kg`);
const m2 = findCatalogMatches(report.catalogo, { ancho: 18, calibre: 75, pn: pn2, pnTolerance: 0.2 });
console.log(`Matches en catálogo: ${m2.length}`);
m2.forEach((m) =>
  console.log(`  ${m.codigo_alterno} | cono=${m.peso_cono} | PN=${m.peso_neto} | PB=${m.peso_total}`),
);
