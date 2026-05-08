// Motor de pricing - SICE Cotizador BioNovaPack
// Toda la lógica de negocio vive aquí. Sin dependencias de UI.

import type {
  LineItem,
  CalcResult,
  SuggestionResult,
  MarginStatus,
} from '@/types';

// Constantes de negocio
export const FC_LBS = 2.20462;
export const PN_FORMULA_CONST = 0.0000018148;
export const MARGIN_MIN = 0.12;        // 12% markup mínimo
export const TRAILER_MAX_KG = 20412;   // capacidad máxima de un trailer

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
export function calcPN(ancho: number, largo: number, calibre: number): number {
  return ancho * largo * calibre * PN_FORMULA_CONST;
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
  // Pesos del rollo real (lo que se fabrica)
  const pnReal = calcPN(item.aReal, item.lReal, item.calReal);
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

  // Pesos teóricos del cliente (lo que el cliente cree que recibe)
  const pnTeoricoClienteKg = calcPN(item.aCliente, item.lCliente, item.calCliente);
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

  if (precio <= 0 || tc <= 0 || aReal <= 0 || calReal <= 0) return null;

  const costoRolloUSD_max = precio / (1 + marginTarget);
  const costoRolloMXN_max = costoRolloUSD_max * tc;

  const costoTotalKg = costoBaseTotal + transpKgMXN;
  if (costoTotalKg <= 0) return null;

  // Despejar PN directo (no PB - menos cono). Convención de Diego.
  const pnReal_needed = costoRolloMXN_max / costoTotalKg;
  if (pnReal_needed <= 0) return null;

  const lReal = pnReal_needed / (aReal * calReal * PN_FORMULA_CONST);

  const pnTeoricoCliente = calcPN(aCliente, lCliente, calCliente);
  const reduction = pnTeoricoCliente > 0
    ? 1 - pnReal_needed / pnTeoricoCliente
    : 0;

  const pricePerLb = pnTeoricoCliente * FC_LBS > 0
    ? precio / (pnTeoricoCliente * FC_LBS)
    : 0;

  const pbRealKg = pnReal_needed + cono;

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
  if (lReal > lCliente) {
    warnings.push('Largo sugerido > largo declarado, no tiene sentido reducir');
  }

  return {
    lReal: Math.round(lReal),
    pnReal: pnReal_needed,
    pbReal: pbRealKg,
    reduction,
    pricePerLb,
    isValid,
    warnings,
  };
}

// Estado visual del margen para semáforo
export function marginStatus(u: number | null): MarginStatus {
  if (u === null) return { label: 'Sin precio', color: '#64748B', level: 'none' };
  if (u < 0) return { label: 'Pérdida', color: '#EF4444', level: 'loss' };
  if (u < MARGIN_MIN) return { label: `Bajo mínimo (${(u * 100).toFixed(1)}%)`, color: '#F59E0B', level: 'low' };
  return { label: `OK (${(u * 100).toFixed(1)}%)`, color: '#5BAA47', level: 'ok' };
}

// Calcula totales del trailer completo (revenue, costo, utilidad, kg neto)
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
  // Primer pase para totalKgNetoTrailer (necesario para el flete por kg)
  let kgNetoTotal = 0;
  for (const item of items) {
    const pn = calcPN(item.aReal, item.lReal, item.calReal);
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

  // Sumar el flete una sola vez al costo total (ya está distribuido en costoRolloUSD,
  // pero se puede ajustar si la distribución no es exacta)
  const utilidadGlobal = totalCostUSD > 0
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

// Crea un item nuevo con valores por defecto razonables
export function newLineItem(id: number): LineItem {
  return {
    id,
    desc: '',
    unit: 'Cases',
    qty: 1,
    aCliente: 18,
    calCliente: 80,
    lCliente: 1500,
    aReal: 18,
    calReal: 80,
    lReal: 1150,
    cono: 0.6,
    rollosPallet: 48,
    palletTrailer: 20,
    costoBase: 47.08,
    master: 0,
    intenso: 0,
    aditivo: 0,
    aumento1: 0,
    aumento2: 0,
    refilado: 1.5,
    cajaMXN: 0,
    rollosCaja: 4,
    tipoResina: 'virgen',
    tipoColor: 'clear',
    precioCliente: 0,
  };
}
