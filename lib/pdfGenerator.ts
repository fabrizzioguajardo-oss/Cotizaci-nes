// Generación de PDFs - Cotización para cliente y PO para Extruidos
// Formato basado en los documentos reales de BioNovaPack/NovaPack LLC

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { LineItem, CalcResult } from '@/types';
import { calcLineItem, calcTrailerTotals, calcPN } from './pricingEngine';

// Colores BioNovaPack
const BNP_GREEN: [number, number, number] = [91, 170, 71];
const BNP_PURPLE: [number, number, number] = [107, 44, 145];
const TEXT_DARK: [number, number, number] = [20, 30, 40];
const TEXT_GRAY: [number, number, number] = [120, 130, 140];
const BG_LIGHT: [number, number, number] = [245, 247, 250];

interface PdfMeta {
  cliente: string;
  contacto?: string;
  direccion?: string;
  fecha: string;
  numero: string;
  vendedor: string;
  tc: number;
  transportUSD: number;
}

// Header común a ambos PDFs
function drawHeader(doc: jsPDF, title: string, isPO: boolean) {
  // Banda verde superior
  doc.setFillColor(...BNP_GREEN);
  doc.rect(0, 0, 210, 8, 'F');

  // Logo simulado (texto estilizado)
  doc.setTextColor(...BNP_GREEN);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('BIONOVA', 14, 22);
  doc.setTextColor(...BNP_PURPLE);
  doc.text('PACK', 50, 22);

  // Datos de la empresa
  doc.setTextColor(...TEXT_DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('NOVAPACK LLC', 14, 30);
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text('3441 Halifax St.', 14, 35);
  doc.text('Dallas, Texas 75247', 14, 39);
  doc.text('USA', 14, 43);

  // Título del documento (a la derecha)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...(isPO ? BNP_PURPLE : BNP_GREEN));
  doc.text(title, 196, 22, { align: 'right' });

  // Línea divisora
  doc.setDrawColor(...BNP_GREEN);
  doc.setLineWidth(0.5);
  doc.line(14, 50, 196, 50);
}

function drawMetaBox(doc: jsPDF, meta: PdfMeta, isPO: boolean) {
  const leftLabel = isPO ? 'TO (Supplier):' : 'BILL TO:';
  const supplierLines = [
    'EXTRUIDOS DE POLIETILENO S.A. DE C.V.',
    'Lote 7, Manzana 6, Parque Industrial Tepotzotlan',
    'Tepotzotlan, Estado de Mexico',
    'Mexico',
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text(leftLabel, 14, 60);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(10);

  if (isPO) {
    supplierLines.forEach((line, i) => {
      doc.setFontSize(i === 0 ? 10 : 8);
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
      doc.text(line, 14, 66 + i * 4);
    });
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text(meta.cliente, 14, 66);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (meta.contacto) doc.text(meta.contacto, 14, 71);
    if (meta.direccion) {
      const lines = meta.direccion.split('\n');
      lines.forEach((line, i) => doc.text(line, 14, 75 + i * 4));
    }
  }

  // Bloque derecho con número y fecha
  doc.setFillColor(...BG_LIGHT);
  doc.rect(140, 56, 56, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text(isPO ? 'PO #' : 'QUOTE #', 144, 62);
  doc.text('DATE', 144, 70);
  doc.text(isPO ? 'BUYER' : 'PREPARED BY', 144, 78);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  doc.text(meta.numero, 170, 62);
  doc.text(meta.fecha, 170, 70);
  doc.text(meta.vendedor, 170, 78);
}

// === COTIZACIÓN AL CLIENTE ===
// Usa el SPEC DECLARADO en la descripción
export function generateQuotePDF(
  items: LineItem[],
  results: CalcResult[],
  meta: PdfMeta,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  drawHeader(doc, 'QUOTATION', false);
  drawMetaBox(doc, meta, false);

  const totals = calcTrailerTotals(items, meta.tc, meta.transportUSD);

  // Tabla de items.
  // QTY y total de línea usan rollosPallet×palletTrailer (las unidades reales
  // que usa el motor de pricing en calcTrailerTotals para revenue/costo). Antes
  // la columna QTY mostraba item.qty mientras el gran total usaba
  // rollosPallet×palletTrailer → la suma de líneas no cuadraba con el TOTAL.
  // (La semántica de venta por Cases/Pallets vs rollo queda pendiente de
  // confirmar con el área comercial; por ahora el documento es internamente
  // consistente con lo que la app calcula como ingreso.)
  const body = items.map((item, i) => {
    const r = results[i];
    const unidades = item.rollosPallet * item.palletTrailer;
    const totalLine = item.precioCliente * unidades;
    const description = `${item.desc || 'PALLET WRAP'} - ${item.aCliente}″ × ${item.calCliente}GA × ${item.lCliente}′`;
    return [
      String(unidades),
      item.unit.toUpperCase(),
      description,
      `$${item.precioCliente.toFixed(2)}`,
      `$${totalLine.toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: 95,
    head: [['QTY', 'UNIT', 'DESCRIPTION', 'UNIT PRICE', 'TOTAL PRICE']],
    body,
    theme: 'plain',
    headStyles: {
      fillColor: BNP_GREEN,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: TEXT_DARK,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'center', cellWidth: 18 },
      2: { cellWidth: 90 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: BG_LIGHT },
    margin: { left: 14, right: 14 },
  });

  // Totales
  const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let y = lastY + 6;

  const subtotal = totals.totalRevenueUSD - meta.transportUSD;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  doc.text('Subtotal:', 145, y, { align: 'right' });
  doc.text(`$${subtotal.toFixed(2)}`, 196, y, { align: 'right' });
  y += 5;
  doc.text('Shipment:', 145, y, { align: 'right' });
  doc.text(`$${meta.transportUSD.toFixed(2)}`, 196, y, { align: 'right' });
  y += 6;
  doc.setFillColor(...BNP_GREEN);
  doc.rect(125, y - 4, 71, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL (USD):', 145, y + 1, { align: 'right' });
  doc.text(`$${totals.totalRevenueUSD.toFixed(2)}`, 196, y + 1, { align: 'right' });

  // Payment Information
  y += 18;
  doc.setTextColor(...TEXT_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Payment Information', 14, y);
  y += 1;
  doc.setDrawColor(...BNP_GREEN);
  doc.line(14, y, 75, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const paymentInfo = [
    'Bank: Bank of America',
    'Account Holder: NOVAPACK LLC',
    'Account #: 488162046099',
    'Routing # (ACH): 111000025',
    'Wire Routing #: 026009593',
    'Address: 3441 Halifax St. Dallas, TX 75247',
  ];
  paymentInfo.forEach((line, i) => doc.text(line, 14, y + i * 4));

  // Cláusulas
  y = y + paymentInfo.length * 4 + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Terms & Conditions', 14, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_GRAY);
  const clauses = [
    '1. Payment Terms: 2% 10 Days Net 30 from invoice date.',
    '2. Prices are valid for 30 days from quote date and subject to material cost changes.',
    '3. Delivery dates are estimates and depend on production scheduling and freight availability.',
  ];
  clauses.forEach((c, i) => {
    const lines = doc.splitTextToSize(c, 182);
    doc.text(lines, 14, y + i * 8);
  });

  return doc;
}

// === PURCHASE ORDER A EXTRUIDOS ===
// Usa el SPEC REAL en la descripción
export function generatePOPDF(
  items: LineItem[],
  results: CalcResult[],
  meta: PdfMeta,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  drawHeader(doc, 'PURCHASE ORDER', true);
  drawMetaBox(doc, meta, true);

  // Tabla de items con SPEC REAL.
  // QTY usa rollosPallet×palletTrailer (consistente con el multiplicador del
  // costo de línea, que ya usaba ese valor). Antes la columna QTY mostraba
  // item.qty pero el costo se multiplicaba por rollosPallet×palletTrailer.
  const body = items.map((item, i) => {
    const r = results[i];
    const unidades = item.rollosPallet * item.palletTrailer;
    const totalLineMXN = r.costoRolloMXN * unidades;
    const description = `${item.desc || 'PALLET WRAP'} - ${item.aReal}″ × ${item.calReal}GA × ${item.lReal}′`;
    return [
      String(unidades),
      item.unit.toUpperCase(),
      description,
      `$${r.costoRolloMXN.toFixed(2)} MXN`,
      `$${totalLineMXN.toFixed(2)} MXN`,
    ];
  });

  autoTable(doc, {
    startY: 95,
    head: [['QTY', 'UNIT', 'DESCRIPTION (real spec)', 'UNIT COST', 'TOTAL COST']],
    body,
    theme: 'plain',
    headStyles: {
      fillColor: BNP_PURPLE,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: { fontSize: 9, textColor: TEXT_DARK },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'center', cellWidth: 18 },
      2: { cellWidth: 90 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: BG_LIGHT },
    margin: { left: 14, right: 14 },
  });

  const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let y = lastY + 6;

  const totalCostMXN = results.reduce(
    (acc, r, i) => acc + r.costoRolloMXN * items[i].rollosPallet * items[i].palletTrailer,
    0,
  );
  const totalCostUSD = totalCostMXN / meta.tc;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  doc.text(`TC: ${meta.tc.toFixed(4)} MXN/USD`, 14, y);
  y += 6;

  doc.setFillColor(...BNP_PURPLE);
  doc.rect(125, y - 4, 71, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL (USD):', 145, y + 1, { align: 'right' });
  doc.text(`$${totalCostUSD.toFixed(2)}`, 196, y + 1, { align: 'right' });

  y += 14;
  doc.setTextColor(...TEXT_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Production Notes', 14, y);
  doc.setDrawColor(...BNP_PURPLE);
  doc.line(14, y + 1, 75, y + 1);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text('• Spec mostrado es el spec real de fabricación.', 14, y);
  doc.text('• Etiquetas y documentación al cliente usan spec declarado.', 14, y + 4);
  doc.text(`• Total kg neto trailer: ${(calcTrailerTotals(items, meta.tc, meta.transportUSD).kgNetoTotal).toFixed(1)} kg`, 14, y + 8);

  return doc;
}

// ============================================================================
// === COTIZACIÓN EXTRUIDOS (México, MXN) =====================================
// ============================================================================
// Formato distinto al de BioNovaPack: español, pesos, IVA 16%, columnas de
// tarima (cantidad x tarima / no. tarimas / precio anterior / precio nuevo /
// total por tarima), observaciones fijas y pie con el analista. Basado en el
// formato real "COTIZACIÓN EXTRUIDOS.xlsx".

const EXT_NAVY: [number, number, number] = [31, 42, 77];   // #1F2A4D
const EXT_BLUE: [number, number, number] = [62, 142, 222]; // #3E8EDE
const IVA_RATE = 0.16;

export interface ExtruidosMeta {
  cliente: string;
  correo?: string;
  contacto?: string;
  telefono?: string;
  fecha: string;
  numero: string;
  formaPago: string;          // etiqueta legible (CONTADO / CRÉDITO 30 DÍAS…)
  anticipo: number;           // MXN
  // Pie / analista
  vendedor: string;
  vendedorEmail?: string;
  vendedorTel?: string;
}

const EXT_RAZON = 'EXTRUIDOS BOLSA POLIETILENO, S.A. DE C.V.';
const EXT_DOMICILIO =
  'Autopista Méx - Querétaro KM. 37.5 #5010 Bodega 46, Complejo Industrial, Cuautitlán Izcalli, Edo. de México C.P. 54730';

function mxn(n: number): string {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Genera la cotización al cliente con el formato y marca de Extruidos (MXN).
// Cada línea: cantidad por tarima (rollosPallet) × no. de tarimas (palletTrailer),
// unidad, descripción, precio anterior (opcional), precio nuevo (precioCliente
// en MXN) y total por tarima (precioCliente × rollosPallet).
export function generateExtruidosQuotePDF(
  items: LineItem[],
  meta: ExtruidosMeta,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Banda superior navy
  doc.setFillColor(...EXT_NAVY);
  doc.rect(0, 0, 210, 8, 'F');

  // Encabezado: razón social + domicilio + "COTIZACIÓN"
  doc.setTextColor(...EXT_NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('EXTRUIDOS', 105, 20, { align: 'center' });
  doc.setTextColor(...EXT_BLUE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(EXT_RAZON, 105, 26, { align: 'center' });
  doc.setTextColor(...TEXT_GRAY);
  doc.setFontSize(7);
  const domLines = doc.splitTextToSize(EXT_DOMICILIO, 180);
  doc.text(domLines, 105, 31, { align: 'center' });

  doc.setDrawColor(...EXT_NAVY);
  doc.setLineWidth(0.5);
  doc.line(14, 40, 196, 40);

  doc.setTextColor(...EXT_NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('COTIZACIÓN', 105, 48, { align: 'center' });

  // Datos del cliente
  let y = 58;
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  const field = (label: string, value: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, yy);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '—', x + doc.getTextWidth(label) + 2, yy);
  };
  field('Cliente:', meta.cliente, 14, y);
  field('Fecha:', meta.fecha, 150, y);
  y += 5;
  field('Correo:', meta.correo ?? '', 14, y);
  field('No.:', meta.numero, 150, y);
  y += 5;
  field('Contacto:', meta.contacto ?? '', 14, y);
  field('Tel:', meta.telefono ?? '', 90, y);
  field('Forma de pago:', meta.formaPago, 150, y);

  // Vigencia
  y += 7;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_GRAY);
  doc.text(
    'LA VIGENCIA DE ESTA COTIZACIÓN ES DE 7 DÍAS HÁBILES A PARTIR DE LA FECHA DE ELABORACIÓN',
    14,
    y,
  );

  // Tabla de partidas
  let subtotal = 0;
  const body = items.map((item) => {
    const cantTarima = item.rollosPallet || 0;
    const noTarimas = item.palletTrailer || 0;
    const totalPorTarima = item.precioCliente * cantTarima; // por tarima
    subtotal += totalPorTarima * noTarimas;
    const desc =
      `${item.aCliente} ${item.calCliente} ${item.lCliente} ${item.tipoColor !== 'clear' ? item.tipoColor.toUpperCase() + ' ' : ''}${item.tipoResina.toUpperCase()}`.trim();
    return [
      String(cantTarima),
      item.unit.toUpperCase(),
      String(noTarimas),
      item.desc ? `${item.desc} — ${desc}` : desc,
      item.precioAnterior ? mxn(item.precioAnterior) : '',
      mxn(item.precioCliente),
      mxn(totalPorTarima),
    ];
  });

  autoTable(doc, {
    startY: y + 4,
    head: [[
      'CANT. X TARIMA', 'UNIDAD', 'No. TARIMAS', 'DESCRIPCIÓN',
      'PRECIO ANT./ROLLO', 'PRECIO NUEVO/ROLLO', 'TOTAL/TARIMA',
    ]],
    body,
    theme: 'grid',
    headStyles: { fillColor: EXT_NAVY, textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center' },
    bodyStyles: { fontSize: 8, textColor: TEXT_DARK },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'center', cellWidth: 20 },
      3: { cellWidth: 54 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 24 },
    },
    margin: { left: 14, right: 14 },
  });

  const iva = subtotal * IVA_RATE;
  const total = subtotal + iva;

  let ty = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 9);
    doc.text(label, 150, ty, { align: 'right' });
    doc.text(value, 196, ty, { align: 'right' });
    ty += bold ? 6 : 5;
  };
  doc.setTextColor(...TEXT_DARK);
  totalRow('SUBTOTAL:', mxn(subtotal));
  totalRow('I.V.A. (16%):', mxn(iva));
  doc.setFillColor(...EXT_NAVY);
  doc.rect(125, ty - 4, 71, 8, 'F');
  doc.setTextColor(255, 255, 255);
  totalRow('TOTAL:', mxn(total), true);
  doc.setTextColor(...TEXT_DARK);
  totalRow('ANTICIPO:', mxn(meta.anticipo || 0));

  // Observaciones (texto fijo del formato Extruidos)
  ty += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...EXT_NAVY);
  doc.text('Observaciones:', 14, ty);
  ty += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_GRAY);
  const obs = [
    '- Precios en pesos mexicanos. Este documento es sólo una cotización de precios; no obliga a la compra. Precios aplicables solo a esta cotización.',
    '- Tiempo de entrega en el área metropolitana: 3 días hábiles; pedidos especiales: 5 días hábiles.',
    '- Disponibilidad de material para la primera entrega: 5 días.',
    '- Condiciones de entrega: 500 kg como mínimo para entrega gratuita en CDMX y área metropolitana.',
    '- Precio más IVA.',
  ];
  obs.forEach((o) => {
    const lines = doc.splitTextToSize(o, 182);
    doc.text(lines, 14, ty);
    ty += lines.length * 3.5;
  });

  // Pie: analista / vendedor
  ty += 6;
  doc.setDrawColor(...EXT_BLUE);
  doc.line(14, ty, 75, ty);
  ty += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text('Analista de Gestión de Negocios', 14, ty);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text(meta.vendedor, 14, ty + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_GRAY);
  if (meta.vendedorEmail) doc.text(meta.vendedorEmail, 14, ty + 8);
  if (meta.vendedorTel) doc.text(meta.vendedorTel, 14, ty + 12);

  return doc;
}

// Helper para descargar el PDF
export function savePDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
