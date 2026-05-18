// Verifica que el cotizador habria producido la misma sugerencia de spec real
// que la cotizacion manual del 10mo camion de Level Packaging.

import { calcPN, calcLineItem, suggestRealSpec, newLineItem } from '../lib/pricingEngine';

// Inputs del camion real (de DATOS y LOGISTICA Y TRANSPORTE)
const TC = 17.3;
const MARGEN_OBJETIVO = 0.05; // 5% (de DATOS row 3)
const TRANSPORT_USD = 5500; // estimado de la cotizacion (ETA Ohio)

interface Linea {
  desc: string;
  ancho: number;
  calibre: number;
  largoDeclaradoCliente: number;
  precioClienteUSD: number;
  cono: number;
  costoBase: number;
  // Lo que Diego efectivamente cotizo:
  expectedLargoReal: number;
  expectedPN: number;
  expectedPB: number;
  expectedCostoRolloUSD: number;
  expectedUtilidad: number;
}

const lineas: Linea[] = [
  {
    desc: '9.87" × 80GA Machine Film',
    ancho: 9.87,
    calibre: 80,
    largoDeclaradoCliente: 5000,
    precioClienteUSD: 23.75,
    cono: 0.9,
    costoBase: 50.35,
    expectedLargoReal: 4610,
    expectedPN: 6.6,
    expectedPB: 7.5,
    expectedCostoRolloUSD: 22.59,
    expectedUtilidad: 0.0515,
  },
  {
    desc: '3" × 70GA Bandling Film',
    ancho: 3,
    calibre: 70,
    largoDeclaradoCliente: 1000,
    precioClienteUSD: 1.125,
    cono: 0.15,
    costoBase: 52.90,
    expectedLargoReal: 790,
    expectedPN: 0.3,
    expectedPB: 0.45,
    expectedCostoRolloUSD: 1.071,
    expectedUtilidad: 0.0505,
  },
  {
    desc: '5" × 70GA Bandling Film',
    ancho: 5,
    calibre: 70,
    largoDeclaradoCliente: 1000,
    precioClienteUSD: 1.8417,  // 22.10 / 12 rolls per case
    cono: 0.25,
    costoBase: 51.83,
    expectedLargoReal: 790,
    expectedPN: 0.5,
    expectedPB: 0.75,
    expectedCostoRolloUSD: 1.754,
    expectedUtilidad: 0.0500,
  },
  {
    desc: '20" × 75GA Extended Core',
    ancho: 20,
    calibre: 75,
    largoDeclaradoCliente: 1000,
    precioClienteUSD: 8.4325, // 33.73 / 4 rolls per case
    cono: 0.25,
    costoBase: 52.95,
    expectedLargoReal: 825,
    expectedPN: 2.25,
    expectedPB: 2.5,
    expectedCostoRolloUSD: 8.04,
    expectedUtilidad: 0.0490,
  },
];

console.log('='.repeat(90));
console.log('VERIFICACIÓN: 10mo CAMIÓN LEVEL PACKAGING (Mayo 2026)');
console.log('TC = 17.3, Margen objetivo = 5%');
console.log('='.repeat(90));

// Para distribucion de flete, necesitamos kg neto trailer. De LOGISTICA: 2904 + 4762.8 + 5292 + 720 = 13,678.8 kg
// (linea 1 original) Pero los reales con largos ajustados dan otros pesos. Vamos a usar el calculado.
const transpKgMXNFromExcel = 8.85311577; // DATOS col K
// Reverse: kgNetoTrailer = (TRANSPORT_USD × TC) / transpKgMXN
const kgNetoTrailer = (TRANSPORT_USD * TC) / transpKgMXNFromExcel;
console.log(`\nKG neto trailer (calculado de flete excel): ${kgNetoTrailer.toFixed(1)} kg`);

for (const l of lineas) {
  console.log(`\n${'-'.repeat(90)}`);
  console.log(`${l.desc} (${l.ancho}" × ${l.calibre}GA × ${l.largoDeclaradoCliente}' al cliente)`);
  console.log(`${'-'.repeat(90)}`);

  // 1) Mi sugerencia inversa: dado precio + margen objetivo, qué largo real propongo?
  const suggestion = suggestRealSpec({
    precio: l.precioClienteUSD,
    tc: TC,
    transpKgMXN: transpKgMXNFromExcel,
    costoBaseTotal: l.costoBase,
    aCliente: l.ancho,
    calCliente: l.calibre,
    lCliente: l.largoDeclaradoCliente,
    aReal: l.ancho,
    calReal: l.calibre,
    cono: l.cono,
    marginTarget: MARGEN_OBJETIVO,
  });

  if (!suggestion) {
    console.log('  ✗ Suggestion vacia');
    continue;
  }

  const dLargo = Math.abs(suggestion.lReal - l.expectedLargoReal);
  const matchLargo = dLargo < 30; // tolerancia 30 ft
  console.log(`  Largo real:`);
  console.log(`    Mi cotizador sugiere: ${suggestion.lReal} ft`);
  console.log(`    Cotización manual:    ${l.expectedLargoReal} ft`);
  console.log(`    Diff: ${dLargo.toFixed(0)} ft  ${matchLargo ? '✓ MATCH' : '✗ DIFERENCIA'}`);

  // 2) Aplicar la sugerencia y verificar costo+utilidad
  const item = {
    ...newLineItem(1),
    desc: l.desc,
    aCliente: l.ancho, calCliente: l.calibre, lCliente: l.largoDeclaradoCliente,
    aReal: l.ancho, calReal: l.calibre, lReal: suggestion.lReal,
    cono: l.cono, costoBase: l.costoBase,
    precioCliente: l.precioClienteUSD,
    rollosPallet: 1, palletTrailer: 1, // no afecta el calculo per-rollo
  };
  const result = calcLineItem(item, TC, TRANSPORT_USD, kgNetoTrailer);

  const dCosto = Math.abs(result.costoRolloUSD - l.expectedCostoRolloUSD);
  const matchCosto = dCosto < 0.1;
  console.log(`  Costo USD/rollo:`);
  console.log(`    Mi cotizador: $${result.costoRolloUSD.toFixed(3)}`);
  console.log(`    Manual:       $${l.expectedCostoRolloUSD.toFixed(3)}`);
  console.log(`    Diff: $${dCosto.toFixed(3)}  ${matchCosto ? '✓' : '✗'}`);

  const dUtil = Math.abs((result.utilidad ?? 0) - l.expectedUtilidad);
  const matchUtil = dUtil < 0.005;
  console.log(`  Utilidad:`);
  console.log(`    Mi cotizador: ${((result.utilidad ?? 0) * 100).toFixed(2)}%`);
  console.log(`    Manual:       ${(l.expectedUtilidad * 100).toFixed(2)}%`);
  console.log(`    Diff: ${(dUtil * 100).toFixed(2)} pp  ${matchUtil ? '✓' : '✗'}`);

  console.log(`  Reducción de material vs declarado:`);
  console.log(`    ${(suggestion.reduction * 100).toFixed(1)}%`);
  if (suggestion.warnings.length > 0) {
    console.log(`  ⚠ Warnings:`);
    suggestion.warnings.forEach(w => console.log(`    - ${w}`));
  }
}

console.log(`\n${'='.repeat(90)}`);
