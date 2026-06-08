// Auditoría visual de los PDFs de salida (mesa de diseño hallazgo #4).
// Renderiza los TRES documentos reales con datos realistas + casos borde
// (nombre de cliente largo, varias líneas) para revisarlos a ojo.
//   /tmp/audit-quote.pdf  — cotización BioNovaPack (USD)
//   /tmp/audit-po.pdf     — orden de compra a EDSA (USD)
//   /tmp/audit-ext.pdf    — cotización Extruidos (MXN)
//
// Correr: npx tsx scripts/audit-pdfs.ts

import {
  generateQuotePDF,
  generatePOPDF,
  generateExtruidosQuotePDF,
  type ExtruidosMeta,
  type LogoImage,
} from '../lib/pdfGenerator';
import { computeQuote } from '../lib/computeQuote';
import { newLineItem, TRAILER_MAX_KG } from '../lib/pricingEngine';
import type { LineItem, Trailer } from '../types';
import { readFileSync, writeFileSync } from 'fs';

// Lee ancho/alto de un PNG desde su chunk IHDR (offset 16 = width, 20 = height).
function pngDims(buf: Buffer): { w: number; h: number } {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const bnpBuf = readFileSync('public/logos/bionovapack.png');
const bnpDims = pngDims(bnpBuf);
const bnpLogo: LogoImage = {
  dataUrl: `data:image/png;base64,${bnpBuf.toString('base64')}`,
  w: bnpDims.w, h: bnpDims.h, format: 'PNG',
};

const extBuf = readFileSync('public/logos/extruidos.jpg');
const extLogo: LogoImage = {
  dataUrl: `data:image/jpeg;base64,${extBuf.toString('base64')}`,
  w: 900, h: 233, format: 'JPEG',
};

// === BioNovaPack: pedido multi-línea realista (10mo camión) ===
const bnpItems: LineItem[] = [
  { ...newLineItem(1, 1), desc: 'MACHINE WRAP CLEAR 80GA', aCliente: 9.87, calCliente: 80, lCliente: 5000, conoCliente: 0.9, aReal: 9.87, calReal: 80, lReal: 4610, cono: 0.9, rollosPallet: 80, palletTrailer: 5, precioCliente: 23.75, costoBase: 50.35, unit: 'Rolls' },
  { ...newLineItem(2, 1), desc: 'BANDING 3IN 70GA', aCliente: 3, calCliente: 70, lCliente: 1000, conoCliente: 0.15, aReal: 3, calReal: 70, lReal: 790, cono: 0.15, rollosPallet: 1764, palletTrailer: 9, precioCliente: 1.125, costoBase: 52.9, unit: 'Cases' },
  { ...newLineItem(3, 1), desc: 'BANDING 5IN 70GA', aCliente: 5, calCliente: 70, lCliente: 1000, conoCliente: 0.25, aReal: 5, calReal: 70, lReal: 790, cono: 0.25, rollosPallet: 1176, palletTrailer: 9, precioCliente: 1.8417, costoBase: 51.83, unit: 'Cases' },
];
const bnpTrailers: Trailer[] = [{ id: 1, destino: 'Dallas, TX', transport_usd: 7000, kg_max: TRAILER_MAX_KG }];
const bnpQuote = computeQuote(bnpItems, bnpTrailers, 17.3);
const bnpMeta = {
  cliente: 'LEVEL PACKAGING DISTRIBUTION SOLUTIONS INTERNATIONAL LLC', // nombre largo a propósito
  contacto: 'Jennifer Rodríguez-Hernández',
  direccion: '12345 Industrial Parkway Blvd, Suite 4200\nFort Worth, Texas 76137\nUSA',
  fecha: '06/08/2026',
  numero: 'Q-ABC123XYZ',
  vendedor: 'Evers López Sánchez',
  tc: 17.3,
  transportUSD: 7000,
};

writeFileSync('/tmp/audit-quote.pdf', Buffer.from(generateQuotePDF(bnpItems, bnpQuote.perItem, bnpMeta, bnpLogo).output('arraybuffer')));
writeFileSync('/tmp/audit-po.pdf', Buffer.from(generatePOPDF(bnpItems, bnpQuote.perItem, bnpMeta, bnpLogo).output('arraybuffer')));

// === Extruidos: cotización MXN realista ===
const extItems: LineItem[] = [
  { ...newLineItem(1, 1), desc: 'PLAYO TRANSPARENTE', aCliente: 20, calCliente: 60, lCliente: 1000, tipoColor: 'clear', tipoResina: 'virgen', rollosPallet: 320, palletTrailer: 1, precioCliente: 121, precioAnterior: 85.1 },
  { ...newLineItem(2, 1), desc: 'PLAYO NARANJA', aCliente: 20, calCliente: 60, lCliente: 1000, tipoColor: 'orange', tipoResina: 'virgen', rollosPallet: 320, palletTrailer: 2, precioCliente: 117 },
];
const extTrailers: Trailer[] = [{ id: 1, destino: 'México', transport_usd: 0, kg_max: TRAILER_MAX_KG }];
const extQuote = computeQuote(extItems, extTrailers, 1);
const extMeta: ExtruidosMeta = {
  cliente: 'COMERCIALIZADORA Y DISTRIBUIDORA TARIPLAYO DEL BAJÍO S.A. DE C.V.',
  correo: 'coord.compras@tariplayo.com.mx', contacto: 'Diana Blas Montenegro',
  telefono: '444 491 6667', fecha: '08/06/2026', numero: 'COT-XYZ789',
  formaPago: 'CRÉDITO 30 DÍAS', anticipo: 0, vendedor: 'Diego Nieves', vendedorEmail: 'diego.nieves@extruidos.com',
};
writeFileSync('/tmp/audit-ext.pdf', Buffer.from(generateExtruidosQuotePDF(extItems, extMeta, extLogo, extQuote.totals.revenueUSD).output('arraybuffer')));

console.log('PDFs generados en /tmp:');
console.log('  audit-quote.pdf  — BNP cotización  | revenue', bnpQuote.totals.revenueUSD.toFixed(2), 'USD');
console.log('  audit-po.pdf     — BNP PO');
console.log('  audit-ext.pdf    — Extruidos       | subtotal', extQuote.totals.revenueUSD.toFixed(2), 'MXN');
console.log('  BNP logo dims:', bnpDims.w, 'x', bnpDims.h);
