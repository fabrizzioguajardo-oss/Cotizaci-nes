// Red de seguridad ejecutable. Verifica que el cotizador respeta las
// invariantes de negocio que justifican su existencia:
//
//   1. PARIDAD: los dos PDFs (cliente con spec declarado, PO a EDSA con
//      spec real) salen del mismo objeto QuoteResult. La presentación
//      difiere; el cálculo subyacente es uno solo.
//   2. PB_real ≤ PB_cliente: el cono compensatorio jamás infla el peso
//      bruto arriba de lo esperado por el cliente.
//   3. Las violaciones se detectan automáticamente vía warnings.
//
// Si este script sale con exit 1, NO se debe pushear a producción.
//
// Corre con:  npx tsx scripts/verify-pdf-parity.ts
// Incluido en: npm run verify

import type { LineItem, Trailer } from '../types';
import { computeQuote, partitionWarnings } from '../lib/computeQuote';
import { TRAILER_MAX_KG } from '../lib/pricingEngine';

// === Casos de prueba ====================================================

interface Caso {
  nombre: string;
  items: LineItem[];
  trailers: Trailer[];
  tc: number;
  // Expectativas: códigos de warning que DEBEN aparecer y los que NO deben.
  esperaErrores?: Array<'pb_excedido' | 'margen_bajo' | 'margen_perdida' | 'capacidad_excedida' | 'flete_fantasma' | 'logistica_cero' | 'pn_cero' | 'sin_precio'>;
  prohibeErrores?: Array<'pb_excedido' | 'margen_bajo' | 'margen_perdida' | 'capacidad_excedida' | 'flete_fantasma' | 'logistica_cero' | 'pn_cero' | 'sin_precio'>;
}

function baseItem(partial: Partial<LineItem>): LineItem {
  return {
    id: 1,
    trailerId: 1,
    desc: 'TEST',
    unit: 'Cases',
    qty: 0,
    aCliente: 3,
    calCliente: 70,
    lCliente: 1000,
    conoCliente: 0.1,
    aReal: 3,
    calReal: 70,
    lReal: 1000,
    cono: 0.1,
    rollosPallet: 0,
    palletTrailer: 0,
    costoBase: 50,
    master: 0,
    intenso: 0,
    aditivo: 0,
    aumento1: 0,
    aumento2: 0,
    refilado: 0,
    cajaMXN: 0,
    rollosCaja: 0,
    tipoResina: 'virgen',
    tipoColor: 'clear',
    precioCliente: 1.13,
    ...partial,
  };
}

function defaultTrailer(transport = 7000): Trailer {
  return { id: 1, destino: 'Test', transport_usd: transport, kg_max: TRAILER_MAX_KG };
}

const TC = 17.3;

const casos: Caso[] = [
  // === A. Camión real Level Packaging — 4 líneas, spec real conocido ===
  {
    nombre: '10mo camión Level Packaging (todas las líneas con spec real Evers)',
    tc: TC,
    trailers: [defaultTrailer(7000)],
    items: [
      baseItem({
        id: 1, desc: '9.87×80 Machine',
        aCliente: 9.87, calCliente: 80, lCliente: 5000,
        conoCliente: 0.9,
        aReal: 9.87, calReal: 80, lReal: 4610,
        cono: 0.9, rollosPallet: 80, palletTrailer: 5,
        precioCliente: 23.75, costoBase: 50.35,
      }),
      baseItem({
        id: 2, desc: '3×70 Bandling',
        aCliente: 3, calCliente: 70, lCliente: 1000,
        conoCliente: 0.15,
        aReal: 3, calReal: 70, lReal: 790,
        cono: 0.15, rollosPallet: 1764, palletTrailer: 9,
        precioCliente: 1.125, costoBase: 52.90,
      }),
      baseItem({
        id: 3, desc: '5×70 Bandling',
        aCliente: 5, calCliente: 70, lCliente: 1000,
        conoCliente: 0.25,
        aReal: 5, calReal: 70, lReal: 790,
        cono: 0.25, rollosPallet: 1176, palletTrailer: 9,
        precioCliente: 1.8417, costoBase: 51.83,
      }),
      baseItem({
        id: 4, desc: '20×75 Ext Core',
        aCliente: 20, calCliente: 75, lCliente: 1000,
        conoCliente: 0.25,
        aReal: 20, calReal: 75, lReal: 825,
        cono: 0.25, rollosPallet: 320, palletTrailer: 1,
        precioCliente: 8.4325, costoBase: 52.95,
      }),
    ],
    prohibeErrores: ['pb_excedido', 'margen_perdida', 'pn_cero'],
  },

  // === B. Regression test del bug v1.07-v1.08 ===
  // Spec donde antes lReal explotaba y PB_real >> PB_cliente.
  // Hoy el cap del pricingEngine evita esto, pero la red de seguridad
  // detecta cualquier futura regresión.
  {
    nombre: 'Regression v1.07: vendedor mete lReal manual >> lCliente (debe dispararse pb_excedido)',
    tc: TC,
    trailers: [defaultTrailer(7000)],
    items: [
      baseItem({
        id: 1,
        aReal: 3, calReal: 70, lReal: 2540, // ← lReal > lCliente (1000)
        cono: 0.1,
        rollosPallet: 1764, palletTrailer: 9,
        precioCliente: 1.13, costoBase: 50,
      }),
    ],
    // pb_excedido es la violación clave; margen_perdida es consecuencia
    // natural (al exagerar el largo, el costo del rollo supera el precio).
    esperaErrores: ['pb_excedido', 'margen_perdida'],
  },

  // === B'. Regression v1.16: sobrecompensación de cono ===
  // El cliente espera cono 0.10 (conoCliente). El vendedor reduce el largo y
  // sube el cono real a 0.55 (más de lo necesario). pbReal = pnReal + 0.55
  // debe superar pbCliente = pnTeoricoCliente + 0.10. ANTES de v1.16 esto
  // NO se detectaba (computeQuote usaba item.cono en ambos lados y el término
  // se cancelaba). Ahora pbCliente usa conoCliente y SÍ dispara pb_excedido.
  {
    nombre: 'Regression v1.16: cono real >> conoCliente (sobrecompensación)',
    tc: TC,
    trailers: [defaultTrailer(7000)],
    items: [
      baseItem({
        id: 1,
        aCliente: 3, calCliente: 70, lCliente: 1000,
        conoCliente: 0.10,            // lo que el cliente espera
        aReal: 3, calReal: 70, lReal: 800, // largo reducido
        cono: 0.55,                   // cono real inflado de más
        rollosPallet: 1764, palletTrailer: 9,
        precioCliente: 1.80, costoBase: 50,
      }),
    ],
    esperaErrores: ['pb_excedido'],
  },

  // === C. Margen perdida ===
  {
    nombre: 'Margen perdida: costo alto, precio bajo',
    tc: TC,
    trailers: [defaultTrailer(7000)],
    items: [
      baseItem({
        id: 1,
        rollosPallet: 100, palletTrailer: 1,
        precioCliente: 0.50, // vende abajo del costo
        costoBase: 80, master: 20, // costo total alto
      }),
    ],
    esperaErrores: ['margen_perdida'],
  },

  // === D. Margen bajo (entre 0 y 12%) ===
  {
    nombre: 'Margen bajo: utilidad ~5%, debajo del 12% mínimo',
    tc: TC,
    trailers: [defaultTrailer(2000)],
    items: [
      baseItem({
        id: 1,
        aCliente: 3, calCliente: 70, lCliente: 1000,
        aReal: 3, calReal: 70, lReal: 1000,
        rollosPallet: 1764, palletTrailer: 9, // mismas que línea 2 camión real
        precioCliente: 1.28, // calibrado para ~5% margen vs costoBase 50 + flete prorrateado
        costoBase: 50,
      }),
    ],
    esperaErrores: ['margen_bajo'],
    prohibeErrores: ['margen_perdida'],
  },

  // === E. Capacidad de trailer excedida ===
  {
    nombre: 'Trailer excede 19,200 kg netos',
    tc: TC,
    trailers: [defaultTrailer(7000)],
    items: [
      baseItem({
        id: 1,
        aCliente: 20, calCliente: 80, lCliente: 5000,
        conoCliente: 1.0,
        aReal: 20, calReal: 80, lReal: 5000,
        cono: 1.0,
        rollosPallet: 600, palletTrailer: 10, // ~87,000 kg netos
        precioCliente: 50, costoBase: 50,
      }),
    ],
    esperaErrores: ['capacidad_excedida'],
  },

  // === F'. Trailer fantasma con flete > 0 pero sin items (bug del Adversario) ===
  {
    nombre: 'Trailer fantasma: tiene flete asignado pero ninguna línea',
    tc: TC,
    trailers: [
      defaultTrailer(7000),
      { id: 2, destino: 'Trailer fantasma', transport_usd: 3500, kg_max: TRAILER_MAX_KG },
    ],
    items: [
      // Todas las líneas en trailer 1; trailer 2 queda vacío
      baseItem({
        id: 1, trailerId: 1,
        aCliente: 3, calCliente: 70, lCliente: 1000,
        aReal: 3, calReal: 70, lReal: 1000,
        cono: 0.1,
        rollosPallet: 1764, palletTrailer: 9,
        precioCliente: 2.50, costoBase: 50, // calibrado para margen sano
      }),
    ],
    esperaErrores: ['flete_fantasma'],
    prohibeErrores: ['margen_perdida'],
  },

  // === F''. Logística en cero (spec y precio OK, pero rollos/tarima = 0) ===
  {
    nombre: 'Logística cero: spec y precio pero rollosPallet × palletTrailer = 0',
    tc: TC,
    trailers: [defaultTrailer(7000)],
    items: [
      baseItem({
        id: 1,
        aCliente: 3, calCliente: 70, lCliente: 1000,
        conoCliente: 0.1,
        aReal: 3, calReal: 70, lReal: 1000,
        cono: 0.1,
        rollosPallet: 0, palletTrailer: 0, // ← logística sin llenar
        precioCliente: 1.50, costoBase: 50,
      }),
    ],
    esperaErrores: ['logistica_cero'],
  },

  // === F. Spec inválido (PN cero pero hay precio) ===
  {
    nombre: 'Spec inválido: precio sin spec real',
    tc: TC,
    trailers: [defaultTrailer(7000)],
    items: [
      baseItem({
        id: 1,
        aReal: 0, calReal: 0, lReal: 0,
        precioCliente: 1.13,
      }),
    ],
    esperaErrores: ['pn_cero'],
  },

  // === G. Paridad estructural: misma input dos veces = mismo output ===
  // No requiere caso aparte — se verifica abajo programáticamente.
];

// === Ejecución ==========================================================

let totalErrors = 0;
let totalWarns = 0;
let casosFallidos = 0;

console.log('Red de seguridad — verificación de invariantes y paridad de PDFs');
console.log('='.repeat(95));

for (const caso of casos) {
  console.log(`\n• ${caso.nombre}`);

  const quote = computeQuote(caso.items, caso.trailers, caso.tc);
  const { errors, warns } = partitionWarnings(quote.warnings);

  const codigosError = new Set(errors.map((e) => e.code));
  const codigosWarn = new Set(warns.map((w) => w.code));
  const todosLosCodigos = new Set<string>([...codigosError, ...codigosWarn]);

  let casoOk = true;

  // Verificar que aparezcan los esperados
  for (const codeEsperado of caso.esperaErrores ?? []) {
    if (!todosLosCodigos.has(codeEsperado)) {
      console.error(`  ✗ Esperaba warning '${codeEsperado}' pero NO se disparó`);
      casoOk = false;
    } else {
      console.log(`  ✓ Disparó '${codeEsperado}' como se esperaba`);
    }
  }

  // Verificar que NO aparezcan los prohibidos
  for (const codeProhibido of caso.prohibeErrores ?? []) {
    if (todosLosCodigos.has(codeProhibido)) {
      const w = [...errors, ...warns].find((x) => x.code === codeProhibido);
      console.error(`  ✗ Disparó '${codeProhibido}' que NO debería: ${w?.message}`);
      casoOk = false;
    }
  }

  // Reportar otros warnings/errores no esperados
  const noEsperados = [...errors, ...warns].filter((w) => {
    const esperado = (caso.esperaErrores ?? []).includes(w.code as never);
    const prohibido = (caso.prohibeErrores ?? []).includes(w.code as never);
    return !esperado && !prohibido;
  });
  for (const w of noEsperados) {
    const prefix = w.level === 'error' ? '  ⚠ ERROR no esperado' : '  ⚠ Warning';
    console.log(`${prefix} '${w.code}': ${w.message}`);
    if (w.level === 'error') casoOk = false;
  }

  totalErrors += errors.length;
  totalWarns += warns.length;
  if (!casoOk) casosFallidos++;
}

// === Test de paridad estructural ========================================
// Garantiza que llamar computeQuote dos veces con la misma entrada produce
// resultados idénticos. Si esto falla, alguien metió no-determinismo
// (Math.random, Date.now, side effects) en el pipeline de cálculo y los
// dos PDFs podrían divergir.
console.log('\n• Paridad estructural: misma entrada → mismo output');
const casoParidad = casos[0]; // 10mo camión
const q1 = computeQuote(casoParidad.items, casoParidad.trailers, casoParidad.tc);
const q2 = computeQuote(casoParidad.items, casoParidad.trailers, casoParidad.tc);
const j1 = JSON.stringify(q1);
const j2 = JSON.stringify(q2);
if (j1 === j2) {
  console.log('  ✓ computeQuote es determinístico — los dos PDFs van a recibir exactamente el mismo árbol');
} else {
  console.error('  ✗ computeQuote produce outputs distintos con misma entrada (no determinístico)');
  console.error(`     Diff bytes: ${j1.length} vs ${j2.length}`);
  casosFallidos++;
}

// === Paridad PDF Extruidos (México, tc=1) ===============================
// El PDF al cliente de Extruidos calcula SUBTOTAL/IVA/TOTAL. Antes lo hacía
// con aritmética propia, divergiendo del motor (computeQuote) que el servidor
// usa para el snapshot inmutable — el documento firmado y el registro podían
// mentir distinto. Ahora el PDF recibe `quote.totals.revenueUSD` como subtotal
// autoritativo. Este caso fija el contrato: el subtotal que el PDF muestra por
// fila (precio × rollosPallet × palletTrailer) DEBE igualar el revenue del
// motor con tc=1 (México). Si alguien cambia cualquiera de las dos fórmulas,
// este test truena antes de llegar a producción.
console.log('\n• Paridad PDF Extruidos: subtotal del documento == revenue del motor (tc=1)');
{
  const mxItems: LineItem[] = [
    baseItem({
      id: 1, aCliente: 20, calCliente: 60, lCliente: 1000,
      conoCliente: 0.4, aReal: 20, calReal: 60, lReal: 1000, cono: 0.4,
      rollosPallet: 320, palletTrailer: 1, precioCliente: 121, costoBase: 30,
    }),
    baseItem({
      id: 2, aCliente: 20, calCliente: 60, lCliente: 1000,
      conoCliente: 0.4, aReal: 20, calReal: 60, lReal: 1000, cono: 0.4,
      rollosPallet: 320, palletTrailer: 2, precioCliente: 117, costoBase: 30,
    }),
  ];
  const mxTrailers: Trailer[] = [
    { id: 1, destino: 'México', transport_usd: 0, kg_max: TRAILER_MAX_KG },
  ];
  const mxQuote = computeQuote(mxItems, mxTrailers, 1); // tc=1 = México (sin conversión)
  // Misma fórmula que muestra el PDF de Extruidos por fila.
  const subtotalPDF = mxItems.reduce(
    (acc, it) => acc + it.precioCliente * it.rollosPallet * it.palletTrailer, 0,
  );
  const diff = Math.abs(mxQuote.totals.revenueUSD - subtotalPDF);
  if (diff < 0.01) {
    console.log(`  ✓ subtotal documento (${subtotalPDF.toFixed(2)}) == revenue motor (${mxQuote.totals.revenueUSD.toFixed(2)})`);
  } else {
    console.error(`  ✗ subtotal documento (${subtotalPDF.toFixed(2)}) ≠ revenue motor (${mxQuote.totals.revenueUSD.toFixed(2)}) — diff ${diff.toFixed(4)}`);
    casosFallidos++;
  }
}

// === Resumen final ======================================================
console.log('\n' + '='.repeat(95));
console.log(`Casos: ${casos.length} ejecutados, ${casosFallidos} fallidos`);
console.log(`Warnings totales emitidos: ${totalWarns} warn, ${totalErrors} error`);

if (casosFallidos > 0) {
  console.error(`\n✗ FAIL — ${casosFallidos} caso(s) violan invariantes. NO pushear a producción.`);
  process.exit(1);
}

console.log('\n✓ OK — todas las invariantes se sostienen. Red de seguridad sana.');
