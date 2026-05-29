import { generateExtruidosQuotePDF, type ExtruidosMeta } from '../lib/pdfGenerator';
import { newLineItem } from '../lib/pricingEngine';
import { writeFileSync } from 'fs';

const items = [
  { ...newLineItem(1, 1), aCliente: 20, calCliente: 60, lCliente: 1000, tipoColor: 'clear' as const, tipoResina: 'virgen' as const, rollosPallet: 320, palletTrailer: 1, precioCliente: 121, precioAnterior: 85.1 },
  { ...newLineItem(2, 1), aCliente: 20, calCliente: 60, lCliente: 1000, tipoColor: 'orange' as const, tipoResina: 'virgen' as const, rollosPallet: 320, palletTrailer: 2, precioCliente: 117 },
];
const meta: ExtruidosMeta = {
  cliente: 'TARIPLAYO', correo: 'coord.compras@tariplayo.com', contacto: 'Diana Blas',
  telefono: '444 491 6667', fecha: '19/05/2026', numero: 'COT-ABC123',
  formaPago: 'CONTADO', anticipo: 0, vendedor: 'Diego Nieves', vendedorEmail: 'diego.nieves@extruidos.com',
};
const doc = generateExtruidosQuotePDF(items, meta);
const buf = Buffer.from(doc.output('arraybuffer'));
writeFileSync('/tmp/ext-test.pdf', buf);
console.log('OK — PDF Extruidos generado:', buf.length, 'bytes (subtotal esperado ~', (121*320*1 + 117*320*2), 'MXN)');
