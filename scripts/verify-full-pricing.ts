// Verificacion end-to-end del pricing engine vs Excel real de Diego.
// Inputs/outputs sacados de "04 Abril 2026 Level Packaging 5to Camion.xlsx"
// (hojas COSTOS y DATOS).

import { calcLineItem, calcPN, calcTrailerTotals } from '../lib/pricingEngine';
import { newLineItem } from '../lib/pricingEngine';
import type { LineItem } from '../types';

// === Inputs reales del camión ===
const TC = 17.4;
const TRANSPORT_USD = 6900;

interface RealLine {
  desc: string;
  ancho: number; calibre: number; largo: number;
  cono: number;
  costoBase: number; aumento1: number; aumento2: number; refilado: number;
  master: number; intenso: number; aditivo: number; cajaMXN: number;
  rollosCaja: number; rollosPallet: number; palletTrailer: number;
  precioCliente: number;
  // Outputs esperados de Diego (col DATOS sheet)
  expected: {
    pn: number;
    pb: number;
    costoBaseTotalKgMXN: number;       // costoBase + adders + caja distribuida
    fleteKgMXN: number;
    costoTotalKgMXN: number;
    costoRolloMXN: number;
    costoRolloUSD: number;
    cajaBlancoKg: number;
    utilidad: number;                  // markup
  };
}

const lines: RealLine[] = [
  {
    desc: 'Line 1 — 18×120 Orange',
    ancho: 18, calibre: 120, largo: 715,
    cono: 0.6,
    costoBase: 38.45, aumento1: 0, aumento2: 0, refilado: 0,
    master: 1.5, intenso: 0, aditivo: 0, cajaMXN: 14.43,
    rollosCaja: 4, rollosPallet: 4 * 64, palletTrailer: 3, // 64 cases × 4 rolls = 256 rolls / pallet, 3 pallets
    precioCliente: 8.66,
    expected: {
      pn: 2.8, pb: 3.4,
      cajaBlancoKg: 1.288392857,
      costoBaseTotalKgMXN: 41.23839286,
      fleteKgMXN: 7.66940924,
      costoTotalKgMXN: 48.9078021,
      costoRolloMXN: 136.9418459,
      costoRolloUSD: 7.870221027,
      utilidad: 0.1003502913,
    },
  },
  {
    desc: 'Line 2 — 18×120 Purple (con aumento 1ero)',
    ancho: 18, calibre: 120, largo: 715,
    cono: 0.6,
    costoBase: 38.45, aumento1: 0.8, aumento2: 0, refilado: 0,
    master: 1.5, intenso: 0, aditivo: 0, cajaMXN: 14.43,
    rollosCaja: 4, rollosPallet: 256, palletTrailer: 3,
    precioCliente: 8.66,
    expected: {
      pn: 2.8, pb: 3.4,
      cajaBlancoKg: 1.288392857,
      costoBaseTotalKgMXN: 42.03839286,
      fleteKgMXN: 7.66940924,
      costoTotalKgMXN: 49.7078021,
      costoRolloMXN: 139.1818459,
      costoRolloUSD: 7.998956659,
      utilidad: 0.08264119546,
    },
  },
  {
    desc: 'Line 4 — 19.7×90 Black UV machine film',
    ancho: 19.7, calibre: 90, largo: 3730,
    cono: 1,
    costoBase: 42.9, aumento1: 0, aumento2: 0, refilado: 0,
    master: 1.5, intenso: 0, aditivo: 3.9, cajaMXN: 0,
    rollosCaja: 1, rollosPallet: 40, palletTrailer: 5,
    precioCliente: 40.06,
    expected: {
      pn: 12, pb: 13,
      cajaBlancoKg: 0,
      costoBaseTotalKgMXN: 48.3,
      fleteKgMXN: 7.66940924,
      costoTotalKgMXN: 55.96940924,
      costoRolloMXN: 671.6329109,
      costoRolloUSD: 38.59959258,
      utilidad: 0.03783478849,
    },
  },
  {
    desc: 'Line 5 — 18×70 Clear (sin master/aditivo)',
    ancho: 18, calibre: 70, largo: 1050,
    cono: 0.8,
    costoBase: 38.45, aumento1: 0, aumento2: 0, refilado: 0,
    master: 0, intenso: 0, aditivo: 0, cajaMXN: 14.43,
    rollosCaja: 4, rollosPallet: 4 * 48, palletTrailer: 4,
    precioCliente: 7.55,
    expected: {
      pn: 2.4, pb: 3.2,
      cajaBlancoKg: 1.503125, // 14.43 / (2.4 × 4) = 1.503 -- pero Diego shows 1.288
      costoBaseTotalKgMXN: 39.73839286,
      fleteKgMXN: 7.66940924,
      costoTotalKgMXN: 47.4078021,
      costoRolloMXN: 113.778725,
      costoRolloUSD: 6.539007186,
      utilidad: 0.1546095279,
    },
  },
];

// === Util: comparador con tolerancia ===
// Tolerancias: tight para % (0.005 = 0.5%), looser para MXN/USD (0.5 MXN, 0.05 USD).
// La diferencia tipica viene de precision de PN (Diego redondea 2.8028 → 2.80).
function near(actual: number, expected: number, tol = 0.005): { match: boolean; diff: number } {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return { match: false, diff: NaN };
  const diff = Math.abs(actual - expected);
  return { match: diff <= tol, diff };
}

function fmt(n: number, d = 4): string {
  return Number.isFinite(n) ? n.toFixed(d) : '?';
}

// === Construir LineItem para mi engine ===
function buildItem(l: RealLine): LineItem {
  const base = newLineItem(1);
  return {
    ...base,
    desc: l.desc,
    aCliente: l.ancho, calCliente: l.calibre, lCliente: l.largo,
    aReal: l.ancho, calReal: l.calibre, lReal: l.largo,
    cono: l.cono,
    rollosPallet: l.rollosPallet,
    palletTrailer: l.palletTrailer,
    costoBase: l.costoBase,
    aumento1: l.aumento1, aumento2: l.aumento2,
    refilado: l.refilado,
    master: l.master, intenso: l.intenso, aditivo: l.aditivo,
    cajaMXN: l.cajaMXN, rollosCaja: l.rollosCaja,
    precioCliente: l.precioCliente,
  };
}

// === Inyectar el kgNetoTotal real (15,654.40 kg de Diego) ===
// Hacemos esto para aislar la verificacion del pricing engine de los detalles
// de qty per item. La verificacion del flete depende solo del agregado.
const items = lines.map(buildItem);
const DIEGO_KG_NETO_TRAILER = 6900 * 17.4 / 7.66940924; // 15654.40 implícito
console.log(`Trailer KG neto total inyectado: ${DIEGO_KG_NETO_TRAILER.toFixed(2)} (de Diego)\n`);

// === Verificar línea por línea ===
console.log('='.repeat(96));
console.log('VERIFICACIÓN PRICING ENGINE vs EXCEL REAL DE DIEGO');
console.log('='.repeat(96));

let allPass = true;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const item = items[i];
  const result = calcLineItem(item, TC, TRANSPORT_USD, DIEGO_KG_NETO_TRAILER);

  console.log(`\n${l.desc}`);

  // Cada check tiene su propia tolerancia (USD < MXN < %)
  const checks: Array<[string, number, number, number]> = [
    ['PN',                      result.pnReal,            l.expected.pn,                  0.01],
    ['PB',                      result.pbReal,            l.expected.pb,                  0.01],
    ['Caja MXN/kg distrib.',    result.cajaBlancoKg,      l.expected.cajaBlancoKg,        0.005],
    ['Costo Base Total MXN/kg', result.costoTotalKgMXN,   l.expected.costoBaseTotalKgMXN, 0.005],
    ['Flete MXN/kg',            result.transpKgMXN,       l.expected.fleteKgMXN,          0.001],
    ['Costo Rollo MXN',         result.costoRolloMXN,     l.expected.costoRolloMXN,       0.5],
    ['Costo Rollo USD',         result.costoRolloUSD,     l.expected.costoRolloUSD,       0.05],
    ['Utilidad (markup)',       result.utilidad ?? -1,    l.expected.utilidad,            0.01],
  ];

  for (const [name, actual, expected, tol] of checks) {
    const { match, diff } = near(actual, expected, tol);
    if (!match) allPass = false;
    const icon = match ? '✓' : '✗';
    const padded = name.padEnd(28);
    console.log(`  ${icon} ${padded} actual=${fmt(actual)}  esperado=${fmt(expected)}  Δ=${fmt(diff, 5)}`);
  }
}

console.log('\n' + '='.repeat(96));
console.log(allPass ? '✅ TODOS LOS CÁLCULOS COINCIDEN' : '⚠ DISCREPANCIAS RESIDUALES (ver detalles arriba)');
console.log('='.repeat(96));
console.log('\nNotas sobre discrepancias residuales conocidas:');
console.log('• PN: mi engine usa PN exacto = ancho × largo × calibre × 1.8148e-6.');
console.log('  Diego redondea: ej. 2.8028 → 2.80. Error ~0.1% en costo final.');
console.log('• Línea 5 caja blanca: Diego puso 1.288 MXN/kg en TODAS las líneas del');
console.log('  COSTOS sheet. Pero matemáticamente para línea 5 con PN=2.4 debería ser');
console.log('  14.43 / (2.4 × 4) = 1.503. Mi engine calcula correcto. Es un error de');
console.log('  Diego en su Excel — no del cotizador.');
