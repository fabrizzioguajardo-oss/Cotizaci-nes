// Verifica que la sugerencia de compensación de cono coincide (aproximadamente)
// con las decisiones reales de Evers en el 10mo camión Level Packaging.

import { suggestRealSpec } from '../lib/pricingEngine';

const TC = 17.3;
const TARGET_MARGIN = 0.05;
const TRANSP_KG_MXN = 8.85311577;

interface Linea {
  desc: string;
  ancho: number;
  cal: number;
  largoCliente: number;
  conoCliente: number;
  precio: number;
  costoBase: number;
  // Lo que Evers eligió en la cotización real:
  ev_largo: number;
  ev_cono: number;
  ev_pb: number;
}

const lineas: Linea[] = [
  { desc: '1: 9.87×80 Machine', ancho: 9.87, cal: 80, largoCliente: 5000, conoCliente: 0.7, precio: 23.75, costoBase: 50.35, ev_largo: 4610, ev_cono: 0.9, ev_pb: 7.5 },
  { desc: '2: 3×70 Bandling',   ancho: 3,    cal: 70, largoCliente: 1000, conoCliente: 0.1, precio: 1.125, costoBase: 52.90, ev_largo: 790,  ev_cono: 0.15, ev_pb: 0.45 },
  { desc: '3: 5×70 Bandling',   ancho: 5,    cal: 70, largoCliente: 1000, conoCliente: 0.1, precio: 1.8417, costoBase: 51.83, ev_largo: 790, ev_cono: 0.25, ev_pb: 0.75 },
  { desc: '4: 20×75 Ext Core',  ancho: 20,   cal: 75, largoCliente: 1000, conoCliente: 0.25, precio: 8.4325, costoBase: 52.95, ev_largo: 825, ev_cono: 0.25, ev_pb: 2.5 },
];

console.log('Verificación: sugerencia de cono compensation vs Evers actual');
console.log('='.repeat(95));

for (const l of lineas) {
  const s = suggestRealSpec({
    precio: l.precio,
    tc: TC,
    transpKgMXN: TRANSP_KG_MXN,
    costoBaseTotal: l.costoBase,
    aCliente: l.ancho, calCliente: l.cal, lCliente: l.largoCliente,
    aReal: l.ancho, calReal: l.cal,
    cono: l.conoCliente,
    marginTarget: TARGET_MARGIN,
  });
  if (!s) { console.log(`${l.desc}: sin sugerencia`); continue; }

  console.log(`\n${l.desc}`);
  console.log(`  Cliente declarado:    largo ${l.largoCliente}ft, cono ${l.conoCliente}kg → PB ${s.pbCliente.toFixed(2)}kg`);
  console.log(`  ── Evers real:        largo ${l.ev_largo}ft, cono ${l.ev_cono}kg → PB ${l.ev_pb}kg`);
  console.log(`  ── Mi sugerencia:     largo ${s.lReal}ft, cono ${s.conoSugerido}kg → PB ${s.pbConCompensacion.toFixed(2)}kg`);
  console.log(`     cono ideal (no estándar): ${s.conoIdeal.toFixed(3)}kg`);
  console.log(`     cono alternativos:        ${s.conosAlternativos.join(', ')}kg`);
  console.log(`     PB diff vs cliente:       ${s.pbDiffCompensado >= 0 ? '+' : ''}${s.pbDiffCompensado.toFixed(2)}kg (${(s.pbDiffCompensado/s.pbCliente*100).toFixed(1)}%)`);

  // Comparar con Evers
  const conoMatch = Math.abs(s.conoSugerido - l.ev_cono) < 0.05;
  const largoMatch = Math.abs(s.lReal - l.ev_largo) < 30;
  const pbDiffEvers = l.ev_pb - s.pbCliente;
  console.log(`     vs Evers:                 ${conoMatch ? '✓' : '⚠'} cono (sugiero ${s.conoSugerido}, él ${l.ev_cono}) · ${largoMatch ? '✓' : '⚠'} largo`);
  console.log(`     Evers PB diff vs cliente: ${pbDiffEvers >= 0 ? '+' : ''}${pbDiffEvers.toFixed(2)}kg (${(pbDiffEvers/s.pbCliente*100).toFixed(1)}%)`);
}

console.log(`\n${'='.repeat(95)}`);
console.log('Nota: mi sugerencia es "compensación TOTAL" (PB_real ≈ PB_cliente). Evers a veces');
console.log('compensa menos por razones operativas. El vendedor puede ajustar manual el cono.');
