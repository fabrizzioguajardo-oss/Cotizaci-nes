// Análisis de la lista "Precios de producto EDSA- Extruidos 07 de agosto de 2026"
// vs la anterior (17 de abril de 2026). Corre con:
//   npx tsx scripts/analyze-precios-agosto.ts
// Objetivos:
//   1. Validar que el parser de la app lee el archivo nuevo sin errores.
//   2. Medir cambios de precio (¿subió todo? ¿solo algunos?).
//   3. Detectar si el +2.5 MXN/kg de rollos chicos (PN<1.3) YA viene incluido
//      (si es así hay que APAGAR el recargo automático de buildAutoFill).

import { readFileSync } from 'fs';
import { parseEDSAFile } from '../lib/parsers/edsaParser';
import type { ParsedPriceRow } from '../lib/parsers/types';

const NEW_PATH = 'private/Precios de producto EDSA- Extruidos 07 de agosto de 2026.xlsx';
const OLD_PATH = 'private/Precios de producto EDSA- Extruidos 17 de abril de 2026 (1).xlsx';

function load(path: string) {
  const buf = readFileSync(path);
  return parseEDSAFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
}

const nuevo = load(NEW_PATH);
const viejo = load(OLD_PATH);

console.log('=== ARCHIVO NUEVO (07 ago 2026) ===');
console.log('Filas de precio:', nuevo.rows.length);
console.log('Hojas procesadas:', nuevo.sheetsProcessed.length, '→', nuevo.sheetsProcessed.join(', '));
console.log('Hojas saltadas:', nuevo.sheetsSkipped.map((s) => `${s.name} (${s.reason})`).join('; ') || 'ninguna');
console.log('Warnings:', nuevo.warnings.length);
nuevo.warnings.slice(0, 10).forEach((w) => console.log('  ⚠', w));

console.log('\n=== ARCHIVO ANTERIOR (17 abr 2026) ===');
console.log('Filas de precio:', viejo.rows.length);
console.log('Hojas procesadas:', viejo.sheetsProcessed.length);

// Llave de producto: ancho|cono|pesoTotal|resina|tipo (misma fila lógica)
const key = (r: ParsedPriceRow) =>
  `${r.ancho}|${r.cono}|${r.peso_total.toFixed(2)}|${r.resin_class}|${r.product_type}`;

const mapViejo = new Map<string, ParsedPriceRow>();
for (const r of viejo.rows) mapViejo.set(key(r), r);

let matched = 0;
let sinCambio = 0;
const deltas: { k: string; pn: number; old: number; nue: number; diff: number }[] = [];
const nuevos: ParsedPriceRow[] = [];

for (const r of nuevo.rows) {
  const prev = mapViejo.get(key(r));
  if (!prev) {
    nuevos.push(r);
    continue;
  }
  matched++;
  const diff = r.precio_mxn_kg - prev.precio_mxn_kg;
  if (Math.abs(diff) < 0.005) sinCambio++;
  else deltas.push({ k: key(r), pn: r.peso_neto, old: prev.precio_mxn_kg, nue: r.precio_mxn_kg, diff });
}

const removidos = viejo.rows.filter((r) => !nuevo.rows.some((n) => key(n) === key(r))).length;

console.log('\n=== COMPARACIÓN ===');
console.log(`Filas que existen en ambos: ${matched} (sin cambio de precio: ${sinCambio})`);
console.log(`Filas con cambio de precio: ${deltas.length}`);
console.log(`Filas NUEVAS (no estaban en abril): ${nuevos.length}`);
console.log(`Filas REMOVIDAS (estaban en abril, ya no): ${removidos}`);

if (deltas.length > 0) {
  const subidas = deltas.filter((d) => d.diff > 0);
  const bajadas = deltas.filter((d) => d.diff < 0);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  console.log(`\nSubidas: ${subidas.length} (promedio +${avg(subidas.map((d) => d.diff)).toFixed(2)} MXN/kg)`);
  console.log(`Bajadas: ${bajadas.length} (promedio ${avg(bajadas.map((d) => d.diff)).toFixed(2)} MXN/kg)`);

  // Distribución de los tamaños de cambio (para detectar patrones tipo "+2.5 parejo")
  const buckets = new Map<string, number>();
  for (const d of deltas) {
    const b = d.diff.toFixed(2);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  console.log('\nCambios más comunes (delta MXN/kg → # filas):');
  [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([d, n]) => console.log(`  ${d}: ${n} filas`));
}

// === Detección específica del +2.5 en rollos chicos ===
// Comparar el cambio promedio de filas con PN<1.3 vs PN>=1.3.
const chicosD = deltas.filter((d) => d.pn < 1.3);
const grandesD = deltas.filter((d) => d.pn >= 1.3);
const avgOf = (arr: { diff: number }[]) =>
  arr.length ? arr.reduce((a, b) => a + b.diff, 0) / arr.length : 0;

console.log('\n=== ¿EL +2.5 DE ROLLOS CHICOS YA VIENE EN LA LISTA? ===');
console.log(`Filas PN<1.3 en el archivo nuevo: ${nuevo.rows.filter((r) => r.peso_neto < 1.3).length}`);
console.log(`Con cambio de precio — chicos (PN<1.3): ${chicosD.length}, delta promedio ${avgOf(chicosD).toFixed(2)}`);
console.log(`Con cambio de precio — grandes (PN>=1.3): ${grandesD.length}, delta promedio ${avgOf(grandesD).toFixed(2)}`);
const gap = avgOf(chicosD) - avgOf(grandesD);
console.log(`Diferencia chicos vs grandes: ${gap.toFixed(2)} MXN/kg`);
if (chicosD.length >= 3 && gap > 2.0 && gap < 3.0) {
  console.log('→ SEÑAL FUERTE: los rollos chicos subieron ~2.5 más que el resto.');
  console.log('  El aumento YA está en la lista → hay que APAGAR el recargo automático.');
} else if (chicosD.length === 0) {
  console.log('→ Ningún rollo chico cambió de precio: el +2.5 NO parece estar incluido aún.');
} else {
  console.log('→ Sin patrón claro de +2.5; revisar muestras abajo.');
}

// Muestras de rollos chicos para inspección manual
console.log('\nMuestras rollos chicos (viejo → nuevo):');
deltas
  .filter((d) => d.pn < 1.3)
  .slice(0, 8)
  .forEach((d) => console.log(`  ${d.k}  PN=${d.pn}  ${d.old.toFixed(2)} → ${d.nue.toFixed(2)} (${d.diff >= 0 ? '+' : ''}${d.diff.toFixed(2)})`));

console.log('\nMuestras de cambios generales:');
deltas.slice(0, 8).forEach((d) =>
  console.log(`  ${d.k}  ${d.old.toFixed(2)} → ${d.nue.toFixed(2)} (${d.diff >= 0 ? '+' : ''}${d.diff.toFixed(2)})`),
);

// Rango de precios global (sanity)
const precios = nuevo.rows.map((r) => r.precio_mxn_kg);
console.log(`\nRango de precios nuevo archivo: ${Math.min(...precios).toFixed(2)} — ${Math.max(...precios).toFixed(2)} MXN/kg`);
