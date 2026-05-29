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

// Helper para descargar el PDF
export function savePDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
