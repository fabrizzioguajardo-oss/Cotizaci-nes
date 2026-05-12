// Test del comportamiento floor del lookupPrice.
// User caso: PB=2.96 debe tomar el row PB=2.90 (no PB=3.00).
import { readFileSync } from 'fs';
import { parseEDSAFile } from '../lib/parsers/edsaParser';
import { parseColorFile } from '../lib/parsers/colorParser';
import { lookupPrice } from '../lib/lookupEngine';

const edsa = parseEDSAFile(
  readFileSync(
    '/Users/fabrizzio/Downloads/Precios de producto EDSA- Extruidos 17 de abril de 2026.xlsx',
  ).buffer as ArrayBuffer,
);
const color = parseColorFile(
  readFileSync(
    '/Users/fabrizzio/Downloads/Precios Color 21 Abril 2026.xlsx',
  ).buffer as ArrayBuffer,
);

interface TestCase {
  desc: string;
  ancho: number;
  cono: number;
  pb: number;
  expectedPB: number;
  resin_class: 'virgen' | 'color' | 'reciclado';
}

// Uso virgen porque ahi los precios SI varian por PB (en Color son flat 35.65).
// En el sheet "Cono de 0.6" virgen EDSA, los precios bajan al subir PB (rollos
// mas grandes son mas baratos por kg de produccion). Ver Resumen unificado.
const cases: TestCase[] = [
  // CASO DEL USUARIO: PB=2.96 con cono 0.6 debe tomar row PB=2.90 (=47.93)
  // NO row PB=3.00 (=47.69) que era el bug anterior
  { desc: 'PB=2.96 → row 2.90 [virgen]', ancho: 18, cono: 0.6, pb: 2.96, expectedPB: 2.9, resin_class: 'virgen' },
  // PB exacto 3.00 → row 3.00 (boundary)
  { desc: 'PB=3.00 exacto → row 3.00', ancho: 18, cono: 0.6, pb: 3.0, expectedPB: 3.0, resin_class: 'virgen' },
  // PB=3.05 → row 3.00 (no row 3.10)
  { desc: 'PB=3.05 → row 3.00', ancho: 18, cono: 0.6, pb: 3.05, expectedPB: 3.0, resin_class: 'virgen' },
  // PB=2.81 → row 2.80
  { desc: 'PB=2.81 → row 2.80', ancho: 18, cono: 0.6, pb: 2.81, expectedPB: 2.8, resin_class: 'virgen' },
];

console.log('=== TEST: lookup floor por PB ===\n');
let pass = 0;
let fail = 0;
for (const tc of cases) {
  const result = lookupPrice({
    ancho: tc.ancho,
    cono: tc.cono,
    pb: tc.pb,
    resin_class: tc.resin_class,
    preciosEDSA: edsa.rows,
    preciosColor: color.rows,
  });

  if (!result) {
    console.log(`✗ ${tc.desc} — sin resultado`);
    fail++;
    continue;
  }

  // Re-encontrar la fila exacta del Excel: matchea precio + cono + ancho + manual.
  // En caso de empate de precio, tomamos la MAS CERCANA al target PB.
  const universe = tc.resin_class === 'virgen' ? edsa.rows : color.rows;
  const candidates = universe.filter(
    (r) =>
      Math.abs(r.precio_mxn_kg - result.precio_mxn_kg) < 0.001 &&
      Math.abs(r.cono - tc.cono) < 0.01 &&
      r.ancho === tc.ancho,
  );
  const matchRow = candidates.reduce<typeof candidates[number] | null>(
    (acc, c) => (acc === null || Math.abs(c.peso_total - tc.pb) < Math.abs(acc.peso_total - tc.pb) ? c : acc),
    null,
  );
  const actualPB = matchRow?.peso_total ?? -1;
  const ok = Math.abs(actualPB - tc.expectedPB) < 0.05;

  if (ok) {
    console.log(`✓ ${tc.desc}`);
    console.log(`    target PB=${tc.pb}, picked row PB=${actualPB.toFixed(2)} @ ${result.precio_mxn_kg.toFixed(2)} MXN/kg [${result.match_quality}]`);
    pass++;
  } else {
    console.log(`✗ ${tc.desc}`);
    console.log(`    target PB=${tc.pb}, expected row PB=${tc.expectedPB}, got PB=${actualPB.toFixed(2)}`);
    fail++;
  }
}

console.log(`\n${pass}/${pass + fail} tests pasan`);
process.exit(fail === 0 ? 0 : 1);
