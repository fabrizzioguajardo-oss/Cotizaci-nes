// Verifica que los templates limpios se parsean correctamente
import { readFileSync } from 'fs';
import {
  parseEDSATemplate,
  parseColorTemplate,
  parseTarimaTemplate,
  isCleanTemplate,
} from '../lib/parsers/flatTemplateParser';

console.log('=== Validar templates limpios ===\n');

const edsaBuf = readFileSync(`${process.cwd()}/templates/template_precios_EDSA.xlsx`).buffer as ArrayBuffer;
const colorBuf = readFileSync(`${process.cwd()}/templates/template_precios_color.xlsx`).buffer as ArrayBuffer;
const tarimaBuf = readFileSync(`${process.cwd()}/templates/template_tarima.xlsx`).buffer as ArrayBuffer;

console.log('EDSA template:');
console.log('  isCleanTemplate?', isCleanTemplate(edsaBuf, 'edsa'));
const e = parseEDSATemplate(edsaBuf);
console.log(`  rows: ${e.rows.length}, warnings: ${e.warnings.length}`);
console.log(`  sample[0]: ${JSON.stringify(e.rows[0])}`);

console.log('\nColor template:');
console.log('  isCleanTemplate?', isCleanTemplate(colorBuf, 'color'));
const c = parseColorTemplate(colorBuf);
console.log(`  rows: ${c.rows.length}, warnings: ${c.warnings.length}`);
console.log(`  sample[0]: ${JSON.stringify(c.rows[0])}`);

console.log('\nTarima template:');
console.log('  isCleanTemplate?', isCleanTemplate(tarimaBuf, 'tarima'));
const t = parseTarimaTemplate(tarimaBuf);
console.log(`  catalogo: ${t.catalogo.length}, rangos: ${t.rangos.length}, warnings: ${t.warnings.length}`);
console.log(`  catalogo[0]: ${JSON.stringify(t.catalogo[0])}`);
console.log(`  rangos[0]: ${JSON.stringify(t.rangos[0])}`);

// Verificar que un archivo legacy NO se detecta como template limpio
console.log('\n=== Cross-check: archivo legacy NO debe ser template ===');
const legacyEDSA = readFileSync('/Users/fabrizzio/Downloads/Precios de producto EDSA- Extruidos 17 de abril de 2026.xlsx').buffer as ArrayBuffer;
console.log('  legacy EDSA isCleanTemplate?', isCleanTemplate(legacyEDSA, 'edsa'), '(debe ser false)');
