import { generateExtruidosQuotePDF, type ExtruidosMeta, type LogoImage } from '../lib/pdfGenerator';
import { newLineItem, TRAILER_MAX_KG } from '../lib/pricingEngine';
import { computeQuote } from '../lib/computeQuote';
import type { Trailer } from '../types';
import { writeFileSync, readFileSync } from 'fs';

const logoBuf = readFileSync('public/logos/extruidos.jpg');
const logo: LogoImage = {
  dataUrl: `data:image/jpeg;base64,${logoBuf.toString('base64')}`,
  w: 900, h: 233, format: 'JPEG',
};

const items = [
  { ...newLineItem(1, 1), aCliente: 20, calCliente: 60, lCliente: 1000, tipoColor: 'clear' as const, tipoResina: 'virgen' as const, rollosPallet: 320, palletTrailer: 1, precioCliente: 121, precioAnterior: 85.1 },
  { ...newLineItem(2, 1), aCliente: 20, calCliente: 60, lCliente: 1000, tipoColor: 'orange' as const, tipoResina: 'virgen' as const, rollosPallet: 320, palletTrailer: 2, precioCliente: 117 },
];
const meta: ExtruidosMeta = {
  cliente: 'TARIPLAYO', correo: 'coord.compras@tariplayo.com', contacto: 'Diana Blas',
  telefono: '444 491 6667', fecha: '19/05/2026', numero: 'COT-ABC123',
  formaPago: 'CONTADO', anticipo: 0, vendedor: 'Diego Nieves', vendedorEmail: 'diego.nieves@extruidos.com',
};
// México: un solo flete, tc=1 (no conversión). El subtotal del documento sale
// del motor, igual que en producción.
const trailers: Trailer[] = [{ id: 1, destino: 'México', transport_usd: 0, kg_max: TRAILER_MAX_KG }];
const quote = computeQuote(items, trailers, 1);
const doc = generateExtruidosQuotePDF(items, meta, logo, quote.totals.revenueUSD);
const buf = Buffer.from(doc.output('arraybuffer'));
writeFileSync('/tmp/ext-test.pdf', buf);
const subtotalEsperado = 121 * 320 * 1 + 117 * 320 * 2;
console.log('OK — PDF Extruidos generado:', buf.length, 'bytes');
console.log('   subtotal motor:', quote.totals.revenueUSD, 'MXN | esperado:', subtotalEsperado, 'MXN',
  Math.abs(quote.totals.revenueUSD - subtotalEsperado) < 0.01 ? '✓' : '✗ DIVERGE');
