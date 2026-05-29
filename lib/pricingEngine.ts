// Motor de pricing - SICE Cotizador BioNovaPack
// Toda la lógica de negocio vive aquí. Sin dependencias de UI.

import type {
  LineItem,
  CalcResult,
  SuggestionResult,
  MarginStatus,
  Trailer,
} from '@/types';

// Constantes de negocio
export const FC_LBS = 2.20462;
export const PN_FORMULA_CONST = 0.0000018148;
export const MARGIN_MIN = 0.12;        // 12% markup mínimo
export const TRAILER_MAX_KG = 19200;   // capacidad máxima de un trailer (kg neto)

// Tolerancia natural de produccion de la planta. Cuando declaramos al cliente
// un largo de X ft, la planta puede producir entre X*(1-tolerance) y X*(1+tolerance)
// como variacion normal de proceso. Reducciones MAS ALLA de esto son una
// decision comercial intencional (subir margen reduciendo material).
// Configurable: bajar a 0.003 si la planta es muy precisa, subir a 0.01 si es laxa.
export const PLANT_TOLERANCE_PCT = 0.005;  // ±0.5%

// Tamaños estandar de cono disponibles (kg). Extraidos de los Excels de Diego
// (sheets "Cono de X.XXX" y "Color X" donde X mapea a peso del core).
// La sugerencia de cono usa estos como universo de opciones.
export const STANDARD_CONOS = [
  0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.44, 0.5,
  0.55, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0,
];

// Encuentra el cono estandar mas grande que NO exceda el target.
// Estrategia conservadora: prefiere NO sobre-compensar el PB del cliente.
// Si target es 0.72, retorna 0.7 (no 0.8) para no entregar mas peso del declarado.
export function findClosestStandardConoDown(target: number): number {
  if (target <= 0) return STANDARD_CONOS[0];
  for (let i = STANDARD_CONOS.length - 1; i >= 0; i--) {
    if (STANDARD_CONOS[i] <= target) return STANDARD_CONOS[i];
  }
  return STANDARD_CONOS[0];
}

// Retorna 1-3 conos estandar alrededor del ideal para que el vendedor escoja.
// Util para mostrar "tienes estas opciones, escoge segun riesgo aceptable".
export function getConoOptionsNear(target: number, count = 3): number[] {
  if (target <= 0) return STANDARD_CONOS.slice(0, count);
  const sorted = [...STANDARD_CONOS].sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
  return sorted.slice(0, count).sort((a, b) => a - b);
}

// Rangos de validación históricos
export const REDUCTION_MIN = 0.05;
export const REDUCTION_MAX = 0.40;
export const REDUCTION_WARN_HIGH = 0.35;
export const PRICE_PER_LB_MIN = 0.75;
export const PRICE_PER_LB_MAX = 2.0;
export const PRICE_PER_LB_WARN_LOW = 0.85;
export const PRICE_PER_LB_WARN_HIGH = 1.60;

// Calcula el peso neto del rollo (kg) a partir de ancho (in), largo (ft) y calibre (GA).
// Fórmula validada contra todos los camiones reales.
// Valor RAW: util para algoritmo inverso (suggestRealSpec) donde necesitamos precision.
export function calcPN(ancho: number, largo: number, calibre: number): number {
  return ancho * largo * calibre * PN_FORMULA_CONST;
}

// Peso neto FACTURABLE: trunca el PN hacia abajo a 2 decimales (NO redondea
// estandar). Convencion de Diego en su Excel: =REDONDEAR.MENOS(...,2). Para
// 3″×70GA×1000′ el calculo da 0.381 kg → se factura 0.38 (no 0.39).
// Razon: "no regalar producto" — siempre cobrar por el siguiente kg solo
// cuando el rollo lo alcanza completo. Usado en TODOS los flujos de costo y
// despliegue al cliente (calcLineItem, suggestRealSpec, PDFs, kg trailer).
export function calcPNFacturable(ancho: number, largo: number, calibre: number): number {
  const raw = calcPN(ancho, largo, calibre);
  return Math.floor(raw * 100) / 100;
}

// Convierte kg a lbs
export function kgToLbs(kg: number): number {
  return kg * FC_LBS;
}

// Calcula todos los resultados financieros para una línea de pedido.
// Esta es la función "directa": dado el spec real, calcular costo y margen.
export function calcLineItem(
  item: LineItem,
  tc: number,
  transportUSD: number,
  totalKgNetoTrailer: number,
): CalcResult {
  // Pesos del rollo real (lo que se fabrica).
  // PN se factura redondeado HACIA ABAJO a 2 decimales (convencion Diego).
  // Costo y kg trailer se calculan con el valor facturable para hacer match
  // con su Excel y NO regalar producto.
  const pnReal = calcPNFacturable(item.aReal, item.lReal, item.calReal);
  const pbReal = pnReal + item.cono;

  // Peso neto total del item para el trailer
  const kgNetoItem = item.rollosPallet * item.palletTrailer * pnReal;

  // Costo de flete distribuido por kg neto del trailer completo
  const transpKgMXN = totalKgNetoTrailer > 0
    ? (transportUSD * tc) / totalKgNetoTrailer
    : 0;

  // Costo de la caja distribuido por kg
  const cajaBlancoKg = (item.cajaMXN > 0 && item.rollosCaja > 0 && pnReal > 0)
    ? item.cajaMXN / (pnReal * item.rollosCaja)
    : 0;

  // Build-up completo del costo MXN/kg
  const costoTotalKgMXN =
    item.costoBase +
    item.master +
    item.intenso +
    item.aditivo +
    item.aumento1 +
    item.aumento2 +
    item.refilado +
    cajaBlancoKg;

  // Costo del rollo
  // IMPORTANTE: Diego computa por PN (peso neto), no PB. Convención:
  // el cono se amortiza en el costo base via "Caja Blanca" y en el "Costo del cono"
  // del header EDSA, no se multiplica explicitamente. El flete tambien se distribuye
  // por PN (no PB), porque el flete_kg lo calcula como transport_USD*TC / total_PN.
  // Verificado contra el camion real de Level Packaging (5to abril 2026).
  const costoRolloMXN = (costoTotalKgMXN + transpKgMXN) * pnReal;
  const costoRolloUSD = tc > 0 ? costoRolloMXN / tc : 0;

  // Utilidad (markup sobre costo, NO gross margin)
  const utilidad = (item.precioCliente > 0 && costoRolloUSD > 0)
    ? (item.precioCliente - costoRolloUSD) / costoRolloUSD
    : null;

  // Pesos teóricos del cliente (lo que el cliente cree que recibe).
  // Tambien facturable — el cliente va a leer este PN en su invoice/PO.
  const pnTeoricoClienteKg = calcPNFacturable(item.aCliente, item.lCliente, item.calCliente);
  const pnTeoricoClienteLbs = pnTeoricoClienteKg * FC_LBS;

  // Price per pound al cliente (sobre lo que el cliente cree que recibe)
  const pricePerLb = pnTeoricoClienteLbs > 0
    ? item.precioCliente / pnTeoricoClienteLbs
    : 0;

  // % de reducción de material vs spec declarado
  const materialReduction = pnTeoricoClienteKg > 0
    ? 1 - pnReal / pnTeoricoClienteKg
    : 0;

  return {
    pnReal,
    pbReal,
    pnTeoricoClienteKg,
    pnTeoricoClienteLbs,
    kgNetoItem,
    cajaBlancoKg,
    costoTotalKgMXN,
    transpKgMXN,
    costoRolloMXN,
    costoRolloUSD,
    utilidad,
    pricePerLb,
    materialReduction,
  };
}

// Algoritmo de sugerencia inversa (corazón de Tab 2).
// Dado precio_cliente y margen_objetivo, despeja el largo real necesario.
//
// Matemática (verificada contra Excel real de Diego):
//   costoRolloUSD_max = precio / (1 + marginTarget)
//   costoRolloMXN_max = costoRolloUSD_max * tc
//   pnReal_needed     = costoRolloMXN_max / (costoBaseTotal + transpKgMXN)
//   lReal             = pnReal_needed / (aReal * calReal * 1.8148e-6)
// Nota: PN (no PB) — Diego computa costo por kg de resina neta.
export function suggestRealSpec(params: {
  precio: number;
  tc: number;
  transpKgMXN: number;
  costoBaseTotal: number;
  aCliente: number;
  calCliente: number;
  lCliente: number;
  aReal: number;
  calReal: number;
  cono: number;
  marginTarget: number;
}): SuggestionResult | null {
  const {
    precio,
    tc,
    transpKgMXN,
    costoBaseTotal,
    aCliente,
    calCliente,
    lCliente,
    aReal,
    calReal,
    cono,
    marginTarget,
  } = params;

  if (precio <= 0 || tc <= 0 || aReal <= 0 || calReal <= 0 || lCliente <= 0) return null;

  const costoRolloUSD_max = precio / (1 + marginTarget);
  const costoRolloMXN_max = costoRolloUSD_max * tc;

  const costoTotalKg = costoBaseTotal + transpKgMXN;
  // Sanidad: si el costo total por kg es menor a 1 MXN, casi seguro la
  // entrada esta incompleta (faltan costoBase / adders / flete). Sin esto,
  // pnReal_needed_raw explota a miles de kg y lReal_raw a millones de pies,
  // produciendo sugerencias absurdas tipo "fabricar 182,768,501 pies".
  if (costoTotalKg <= 1 || !isFinite(costoTotalKg)) return null;

  // Despejar PN directo (no PB - menos cono). Convención de Diego.
  const pnReal_needed_raw = costoRolloMXN_max / costoTotalKg;
  if (pnReal_needed_raw <= 0 || !isFinite(pnReal_needed_raw)) return null;

  // Largo raw despejado de PN_needed. Lo redondeamos hacia ARRIBA (ceil) para
  // que el PN facturable resultante >= PN necesario, garantizando el margen
  // objetivo. Si redondeamos hacia abajo, el PN truncado quedaria por debajo
  // y el margen real seria menor que el target.
  const lReal_raw = pnReal_needed_raw / (aReal * calReal * PN_FORMULA_CONST);

  const pnTeoricoCliente = calcPNFacturable(aCliente, lCliente, calCliente);
  const pbCliente = pnTeoricoCliente + cono;
  const pricePerLb = pnTeoricoCliente * FC_LBS > 0
    ? precio / (pnTeoricoCliente * FC_LBS)
    : 0;

  // ────────────────────────────────────────────────────────────────────────
  // CAP DURO: si el largo despejado >= largo del cliente, o no es finito, o
  // es negativo/cero, significa que el precio YA cubre el spec del cliente
  // con margen sobrado. No tiene sentido sugerir fabricar MAS material que
  // lo declarado: violaria el PB esperado (subiendo el peso bruto por encima
  // de lo que el cliente "siente" al pesarlo) y produciria sugerencias
  // absurdas (eg. 182M pies cuando se piden 1000). Devolvemos un "no-op
  // suggestion": fabricar tal cual lo pedido, sin compensar el cono.
  // Esto fixea el bug donde el cono compensatorio fallaba al revez: cuando
  // lReal_raw > lCliente, pnReducido es NEGATIVO, conoIdeal se vuelve negativo,
  // y findClosestStandardConoDown retornaba 0.1 sin mas — el cono se quedaba
  // bajo y el PB real (ya inflado por exceso de largo) terminaba en ~1kg vs
  // los ~0.48 esperados.
  // ────────────────────────────────────────────────────────────────────────
  if (!isFinite(lReal_raw) || lReal_raw <= 0 || lReal_raw >= lCliente) {
    const pnAtCliente = calcPNFacturable(aReal, lCliente, calReal);
    return {
      lReal: lCliente,
      pnReal: pnAtCliente,
      pbReal: pnAtCliente + cono,
      reduction: 0,
      pricePerLb,
      isValid: true,
      warnings: [
        'El precio cubre el spec del cliente con el margen objetivo. Fabricar tal cual, sin reducir largo ni compensar cono.',
      ],
      conoSugerido: cono,
      conoIdeal: cono,
      pbCliente,
      pbConCompensacion: pnAtCliente + cono,
      pbDiffCompensado: pnAtCliente - pnTeoricoCliente,
      conosAlternativos: [cono],
    };
  }

  // Largo final (entero, redondeado hacia arriba para cubrir el PN minimo).
  // Red de seguridad: clamp a lCliente como ultimo recurso por si el cap de
  // arriba no atrapara algun edge case (NaN/Infinity en flotantes raros).
  const lReal = Math.min(lCliente, Math.ceil(lReal_raw));
  // PN final que se va a facturar — truncado igual que en calcLineItem.
  const pnReal_facturable = calcPNFacturable(aReal, lReal, calReal);

  const reduction = pnTeoricoCliente > 0
    ? 1 - pnReal_facturable / pnTeoricoCliente
    : 0;

  const pbRealKg = pnReal_facturable + cono;

  const isValid =
    reduction >= REDUCTION_MIN &&
    reduction <= REDUCTION_MAX &&
    pricePerLb >= PRICE_PER_LB_MIN &&
    pricePerLb <= PRICE_PER_LB_MAX &&
    lReal > 0;

  const warnings: string[] = [];
  if (reduction > REDUCTION_WARN_HIGH) {
    warnings.push(`Reducción ${(reduction * 100).toFixed(1)}% > 35%, revisar con Jennifer antes de mandar`);
  }
  if (reduction < REDUCTION_MIN) {
    warnings.push('Reducción muy baja — quizá no necesitas ajuste de spec');
  }
  if (pricePerLb < PRICE_PER_LB_WARN_LOW) {
    warnings.push(`Price/lb $${pricePerLb.toFixed(3)} muy bajo para mercado EUA`);
  }
  if (pricePerLb > PRICE_PER_LB_WARN_HIGH) {
    warnings.push(`Price/lb $${pricePerLb.toFixed(3)} alto, riesgo de rechazo del cliente`);
  }
  if (lReal < 500) {
    warnings.push('Largo real muy corto, validar con planta antes de fabricar');
  }

  // === Compensación de cono ===
  // Estrategia de Evers: cuando reducimos el largo (y por ende el PN), el cliente
  // recibe un paquete que pesa MENOS de lo que esperaba (porque PB_real < PB_cliente).
  // Para mitigar, se sube el cono de forma que PB_real ≈ PB_cliente. El cliente
  // pesa el paquete y "siente" el peso esperado, aunque en realidad parte del peso
  // es cartón del cono (no película).
  //
  // El cono ideal sería: cono + PN_reducido. Pero los conos son discretos (estándar),
  // así que escogemos el cono estándar más cercano sin exceder (conservador).
  // GARANTIA: el cono sugerido NUNCA hace PB_real > PB_cliente. Si pnReducido < 0
  // (estamos fabricando MAS material del declarado), el conoIdeal seria menor que
  // el cono actual y el cap de arriba ya nos llevo al no-op. Por defensa, clamp
  // a >= cono base: subir cono nunca, bajar nunca por error de redondeo.
  const pnReducido = pnTeoricoCliente - pnReal_facturable;
  const conoIdeal = Math.max(cono, cono + pnReducido);
  const conoSugerido = findClosestStandardConoDown(conoIdeal);
  const pbConCompensacion = pnReal_facturable + conoSugerido;
  const pbDiffCompensado = pbConCompensacion - pbCliente;
  const conosAlternativos = getConoOptionsNear(conoIdeal, 3);

  return {
    lReal,
    pnReal: pnReal_facturable,
    pbReal: pbRealKg,
    reduction,
    pricePerLb,
    isValid,
    warnings,
    conoSugerido,
    conoIdeal,
    pbCliente,
    pbConCompensacion,
    pbDiffCompensado,
    conosAlternativos,
  };
}

// Diagnóstico: cuando `suggestRealSpec` retorna `null`, esta función explica
// AL VENDEDOR por qué la sugerencia está vacía. Antes la UI solo decía
// "ingresa precio del cliente y costo base" — confuso cuando ya había
// llenado todo pero el costoTotalKg salía ≤ 1 (lookup falló por RLS, SKU
// nuevo, o adders en cero). El Adversario lo flagueó como sales blocker
// silencioso. Esta función desvela esa razón.
export interface SuggestionDiagnosis {
  ready: boolean;            // true si suggestRealSpec va a producir resultado
  missing: string[];         // lista de campos/condiciones faltantes (humano)
  hint: string;              // pista accionable para mostrar bajo el card
}

export function diagnoseSuggestion(params: {
  precio: number;
  tc: number;
  transpKgMXN: number;
  costoBaseTotal: number;
  aReal: number;
  calReal: number;
  lCliente: number;
}): SuggestionDiagnosis {
  const missing: string[] = [];
  if (params.precio <= 0) missing.push('precio negociado con el cliente');
  if (params.tc <= 0) missing.push('tipo de cambio MXN/USD');
  if (params.aReal <= 0) missing.push('ancho del producto');
  if (params.calReal <= 0) missing.push('calibre (GA) del producto');
  if (params.lCliente <= 0) missing.push('largo declarado al cliente');
  if (params.costoBaseTotal + params.transpKgMXN <= 1) {
    // Costo total por kg < 1 MXN/kg es síntoma de datos incompletos
    // (no se encontró precio EDSA, no hay flete asignado al trailer, etc.).
    if (params.costoBaseTotal <= 0) missing.push('costo base MXN/kg (¿seleccionaste un cono del catálogo?)');
    if (params.transpKgMXN <= 0) missing.push('costo de transporte del trailer (sidebar izquierdo)');
  }

  if (missing.length === 0) {
    return { ready: true, missing: [], hint: '' };
  }

  const hint =
    missing.length === 1
      ? `Falta: ${missing[0]}.`
      : `Faltan: ${missing.slice(0, -1).join(', ')} y ${missing[missing.length - 1]}.`;

  return { ready: false, missing, hint };
}

// Estado visual del margen para semáforo
export function marginStatus(u: number | null): MarginStatus {
  if (u === null) return { label: 'Sin precio', color: '#64748B', level: 'none' };
  if (u < 0) return { label: 'Pérdida', color: '#EF4444', level: 'loss' };
  if (u < MARGIN_MIN) return { label: `Bajo mínimo (${(u * 100).toFixed(1)}%)`, color: '#F59E0B', level: 'low' };
  return { label: `OK (${(u * 100).toFixed(1)}%)`, color: '#5BAA47', level: 'ok' };
}

// Resumen por trailer (peso, capacidad, items)
export interface TrailerSummary {
  trailerId: number;
  kgNetoTotal: number;        // suma de PN × rolls de las lineas del trailer
  capacityPct: number;        // kgNetoTotal / kg_max (0 a 1+)
  itemCount: number;
  totalRevenueUSD: number;
  totalCostUSD: number;
  utilidad: number | null;
  exceedsCapacity: boolean;   // > 100% del kg_max
}

// Calcula totales POR trailer. Cada trailer tiene su propio flete que se
// distribuye SOLO entre sus líneas. Esto es la matemática correcta para
// pedidos multi-trailer (ej. parte va a Ohio, parte a Monterrey).
//
// Compatibilidad: si no se pasan trailers (legacy), se asume 1 trailer con
// transport_usd global recibido como parámetro.
export function calcAllTrailerTotals(
  items: LineItem[],
  trailers: Trailer[],
  tc: number,
): {
  perTrailer: TrailerSummary[];
  totalRevenueUSD: number;
  totalCostUSD: number;
  utilidadGlobal: number | null;
  kgNetoTotal: number;
  unidadesTotales: number;
} {
  const perTrailer: TrailerSummary[] = trailers.map((t) => {
    const trailerItems = items.filter((it) => it.trailerId === t.id);
    let kg = 0;
    for (const it of trailerItems) {
      const pn = calcPNFacturable(it.aReal, it.lReal, it.calReal);
      kg += it.rollosPallet * it.palletTrailer * pn;
    }
    let revenue = 0;
    let cost = 0;
    for (const it of trailerItems) {
      const r = calcLineItem(it, tc, t.transport_usd, kg);
      const unidades = it.rollosPallet * it.palletTrailer;
      revenue += it.precioCliente * unidades;
      cost += r.costoRolloUSD * unidades;
    }
    const utilidad = (cost > 0 && revenue > 0) ? (revenue - cost) / cost : null;
    return {
      trailerId: t.id,
      kgNetoTotal: kg,
      capacityPct: t.kg_max > 0 ? kg / t.kg_max : 0,
      itemCount: trailerItems.length,
      totalRevenueUSD: revenue,
      totalCostUSD: cost,
      utilidad,
      exceedsCapacity: kg > t.kg_max,
    };
  });

  const totalRevenueUSD = perTrailer.reduce((a, t) => a + t.totalRevenueUSD, 0);
  const totalCostUSD = perTrailer.reduce((a, t) => a + t.totalCostUSD, 0);
  const kgNetoTotal = perTrailer.reduce((a, t) => a + t.kgNetoTotal, 0);
  const unidadesTotales = items.reduce((a, it) => a + it.rollosPallet * it.palletTrailer, 0);
  const utilidadGlobal = (totalCostUSD > 0 && totalRevenueUSD > 0)
    ? (totalRevenueUSD - totalCostUSD) / totalCostUSD
    : null;

  return { perTrailer, totalRevenueUSD, totalCostUSD, utilidadGlobal, kgNetoTotal, unidadesTotales };
}

// Calcula totales del trailer completo (revenue, costo, utilidad, kg neto)
// Legacy: usado por código viejo de trailer único. Mantenido por compat.
export function calcTrailerTotals(
  items: LineItem[],
  tc: number,
  transportUSD: number,
): {
  totalRevenueUSD: number;
  totalCostUSD: number;
  utilidadGlobal: number | null;
  kgNetoTotal: number;
  unidadesTotales: number;
} {
  // Primer pase para totalKgNetoTrailer (necesario para el flete por kg).
  // Usa PN facturable para que el flete distribuido haga match con lo que
  // Diego cobra (su Excel tambien factura PN truncado).
  let kgNetoTotal = 0;
  for (const item of items) {
    const pn = calcPNFacturable(item.aReal, item.lReal, item.calReal);
    kgNetoTotal += item.rollosPallet * item.palletTrailer * pn;
  }

  let totalRevenueUSD = 0;
  let totalCostUSD = 0;
  let unidadesTotales = 0;

  for (const item of items) {
    const r = calcLineItem(item, tc, transportUSD, kgNetoTotal);
    const unidadesItem = item.rollosPallet * item.palletTrailer;
    totalRevenueUSD += item.precioCliente * unidadesItem;
    totalCostUSD += r.costoRolloUSD * unidadesItem;
    unidadesTotales += unidadesItem;
  }

  // Utilidad global: solo calcular cuando hay revenue Y costo. Si el usuario
  // todavia no llena precios, mostrar null (= "Sin precio") en lugar de -100%.
  // Esto es congruente con la utilidad por linea individual.
  const utilidadGlobal = (totalCostUSD > 0 && totalRevenueUSD > 0)
    ? (totalRevenueUSD - totalCostUSD) / totalCostUSD
    : null;

  return {
    totalRevenueUSD,
    totalCostUSD,
    utilidadGlobal,
    kgNetoTotal,
    unidadesTotales,
  };
}

// Suma de adders MXN/kg (sin caja, que depende del PN)
export function sumAdders(item: Pick<LineItem,
  'master' | 'intenso' | 'aditivo' | 'aumento1' | 'aumento2' | 'refilado'>): number {
  return item.master + item.intenso + item.aditivo + item.aumento1 + item.aumento2 + item.refilado;
}

// Crea un item nuevo con campos numéricos en 0 y selects en sus defaults mínimos.
// El vendedor llena ancho/calibre/largo y el selector de cono auto-llena el resto.
// trailerId default 1 — el primer trailer del pedido. Vendedor puede arrastrar
// a otro trailer despues.
export function newLineItem(id: number, trailerId = 1): LineItem {
  return {
    id,
    trailerId,
    desc: '',
    unit: 'Cases',
    qty: 0,
    aCliente: 0,
    calCliente: 0,
    lCliente: 0,
    aReal: 0,
    calReal: 0,
    lReal: 0,
    cono: 0,
    rollosPallet: 0,
    palletTrailer: 0,
    costoBase: 0,
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
    precioCliente: 0,
  };
}
