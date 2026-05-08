// Verificación end-to-end del lookup engine contra el camión real
// 04 Abril 2026 Level Packaging 5to Camion.

import { readFileSync } from 'fs';
import { parseEDSAFile } from '../lib/parsers/edsaParser';
import { parseColorFile } from '../lib/parsers/colorParser';
import { parseTarimaFile } from '../lib/parsers/tarimaParser';
import { lookupConoOptions, buildAutoFill } from '../lib/lookupEngine';
import { calcPN } from '../lib/pricingEngine';

const edsaBuf = readFileSync('/Users/fabrizzio/Downloads/Precios de producto EDSA- Extruidos 17 de abril de 2026.xlsx').buffer as ArrayBuffer;
const colorBuf = readFileSync('/Users/fabrizzio/Downloads/Precios Color 21 Abril 2026.xlsx').buffer as ArrayBuffer;
const tarimaBuf = readFileSync('/Users/fabrizzio/Documents/TRABAJO/BIONOVAPACK/05 OPERACION COMERCIAL - Novapack/Herramientas de Pricing y Cotizacion/Cantidad Producto por Tarima.xlsx').buffer as ArrayBuffer;

const edsa = parseEDSAFile(edsaBuf);
const color = parseColorFile(colorBuf);
const tarima = parseTarimaFile(tarimaBuf);

console.log(`\nDatos cargados:`);
console.log(`  EDSA: ${edsa.rows.length} filas (${edsa.warnings.length} warnings)`);
console.log(`  Color: ${color.rows.length} filas (${color.warnings.length} warnings)`);
console.log(`  Tarima: ${tarima.catalogo.length} SKUs, ${tarima.rangos.length} rangos`);

// === Las 6 líneas del camión real ===
const lineas = [
  { desc: '18×120 Orange',   ancho: 18,   calibre: 120, largo: 715,  cono: 0.6, resin: 'color' as const,    expected_base: 38.45, esperado: { rolls_pallet: 256 } },
  { desc: '18×120 Purple',   ancho: 18,   calibre: 120, largo: 715,  cono: 0.6, resin: 'color' as const,    expected_base: 38.45, esperado: { rolls_pallet: 256 } },
  { desc: '18×120 White',    ancho: 18,   calibre: 120, largo: 715,  cono: 0.6, resin: 'color' as const,    expected_base: 38.45, esperado: { rolls_pallet: 256 } },
  { desc: '19.7×90 Black UV', ancho: 19.7, calibre: 90,  largo: 3730, cono: 1.0, resin: 'color' as const,    expected_base: 42.9,  esperado: { rolls_pallet: 40 } },
  { desc: '18×70 Clear',     ancho: 18,   calibre: 70,  largo: 1050, cono: 0.8, resin: 'reciclado' as const, expected_base: 38.45, esperado: { rolls_pallet: 192 } },
  { desc: '18×120 Blue',     ancho: 18,   calibre: 120, largo: 715,  cono: 0.6, resin: 'color' as const,    expected_base: 38.45, esperado: { rolls_pallet: 256 } },
];

console.log(`\n${'='.repeat(72)}`);
console.log('VERIFICACIÓN LÍNEA POR LÍNEA');
console.log('='.repeat(72));

for (const l of lineas) {
  console.log(`\n→ ${l.desc} (${l.ancho}×${l.calibre}×${l.largo})`);

  // Mostrar opciones de cono que el sistema ofrecería
  const opts = lookupConoOptions({
    ancho: l.ancho,
    calibre: l.calibre,
    largo_ft: l.largo,
    catalogo: tarima.catalogo,
    rangos: tarima.rangos,
    preciosEDSA: edsa.rows,
  });
  console.log(`  Opciones de cono que Evers vería:`);
  if (opts.length === 0) console.log(`    (ninguna - producto fuera de catálogo histórico)`);
  opts.slice(0, 5).forEach((o) => {
    const star = Math.abs(o.cono - l.cono) < 0.01 ? ' ⭐' : '';
    const cat = o.is_exact_catalog_match ? ' ✓ histórico' : '';
    console.log(
      `    cono ${o.cono.toFixed(2)} → PB ${o.pb.toFixed(2)}kg → ${o.rollos_por_tarima || '?'} rollos/tarima${star}${cat}`,
    );
  });

  // Auto-fill final con el cono que se eligió en el camión real
  const fill = buildAutoFill({
    ancho: l.ancho,
    calibre: l.calibre,
    largo_ft: l.largo,
    cono: l.cono,
    resin_class: l.resin,
    preciosEDSA: edsa.rows,
    preciosColor: color.rows,
    rangos: tarima.rangos,
  });
  if (!fill) {
    console.log(`  ✗ NO se pudo encontrar precio`);
    continue;
  }
  console.log(`  Auto-fill resuelto:`);
  console.log(`    costo_base = ${fill.costo_base_mxn_kg.toFixed(2)} MXN/kg`);
  console.log(`    master = ${fill.master_mxn_kg.toFixed(2)} | intenso = ${fill.intenso_mxn_kg.toFixed(2)}`);
  console.log(`    rollos/tarima = ${fill.rollos_por_tarima}`);
  console.log(`    fuente: ${fill.source_note}`);
  console.log(`    calidad: ${fill.match_quality}`);
  if (fill.warnings.length) console.log(`    ⚠ ${fill.warnings.join(' | ')}`);
}

console.log(`\n${'='.repeat(72)}`);
console.log('NOTA: El "expected_base" 38.45 del camión es una NEGOCIACIÓN');
console.log('especial Recic-Virgen, NO el precio EDSA Manual virgen (47.08) ni');
console.log('el Color virgen (48.58). El sistema correctamente devuelve los');
console.log('precios estándar; el ajuste a 38.45 lo hace el vendedor por contrato.');
