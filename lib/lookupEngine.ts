// Lookup engine unificado.
// Toma los outputs de los 3 parsers (EDSA, Color, Tarima) y expone una API
// que el LineItemEditor usa para auto-llenar costos al cotizar.
//
// Flujo (visión de Evers):
//   1. Evers entra ancho=18, calibre=120, largo=715
//   2. lookupConoOptions(18, 120, 715) -> array de opciones [{cono, rolls/pallet, PB}]
//   3. Evers elige cono (o sistema sugiere el mas comun)
//   4. lookupPrice({ancho, cono, PB, resin_class}) -> MXN/kg
//   5. LineItemEditor se auto-llena

import { calcPN } from './pricingEngine';
import type {
  ParsedPriceRow,
  ParsedTarimaRow,
  ParsedTarimaRange,
  ResinClass,
  ProductType,
} from './parsers/types';
import {
  findCatalogMatches,
  findTarimaRule,
  uniqueConosFor,
} from './parsers/tarimaParser';

// Una opción de cono que se le presenta a Evers en el modal de selección
export interface ConoOption {
  cono: number;                     // peso del cono (kg)
  pn: number;                       // PN teorico calculado
  pb: number;                       // PB = PN + cono
  rollos_por_tarima: number;        // de la regla "General"
  pz_por_cama: number;
  camas_por_tarima: number;
  // Si existe match exacto en el catalogo de SKUs
  catalog_match: {
    codigo_alterno: string | null;
    largo_real: number | null;
    largo_aprox: number | null;
  } | null;
  // Estimación de precio MXN/kg base virgen (si encontramos match en EDSA)
  precio_estimado_mxn_kg: number | null;
  is_exact_catalog_match: boolean;  // true si esta combinación está en SKUs históricos
}

export interface PriceLookupResult {
  precio_mxn_kg: number;
  source_file: 'edsa' | 'color';
  source_sheet: string;
  resin_class: ResinClass;
  product_type: ProductType;
  raw_description: string;
  // Adders embebidos detectados (master, intenso) para auto-fill opcional
  master_mxn_kg?: number;
  intenso_mxn_kg?: number;
  // Es un match exacto o interpolado/aproximado
  match_quality: 'exact' | 'close' | 'interpolated';
  match_distance_pb: number;  // diferencia entre PB buscado y PB encontrado
}

// === Sugerir opciones de cono dado un spec del cliente ===

// Para una combinación (ancho, calibre, largo) devuelve las opciones de cono
// disponibles, ordenadas por uso histórico (catalogo > sin catalogo).
export function lookupConoOptions(params: {
  ancho: number;
  calibre: number;
  largo_ft: number;
  catalogo: ParsedTarimaRow[];
  rangos: ParsedTarimaRange[];
  preciosEDSA: ParsedPriceRow[];
}): ConoOption[] {
  const { ancho, calibre, largo_ft, catalogo, rangos, preciosEDSA } = params;
  const pn = calcPN(ancho, largo_ft, calibre);

  // 1) Ver qué conos están disponibles para este (ancho, calibre)
  let conos = uniqueConosFor(catalogo, ancho, calibre);

  // 2) Si el catálogo no tiene este (ancho, calibre), caer al universo de
  //    precios — incluye TODOS los product_types (manual, semi, auto, hp...)
  //    para no perder los machine films / auto products
  if (conos.length === 0) {
    const universe = new Set<number>();
    // Tolerar pequeño mismatch en ancho (19.7 ≈ 20)
    const anchoTol = 0.5;
    for (const r of preciosEDSA) {
      if (Math.abs(r.ancho - ancho) <= anchoTol) universe.add(r.cono);
    }
    conos = Array.from(universe).sort((a, b) => a - b);
  }

  // 3) Para cada cono, calcular PB y reglas de tarima
  const options: ConoOption[] = [];
  for (const cono of conos) {
    const pb = pn + cono;
    const rule = findTarimaRule(rangos, ancho, pb);
    const exactMatch = findCatalogMatches(catalogo, {
      ancho,
      calibre,
      pn,
      pnTolerance: 0.1,
    }).find((c) => Math.abs(c.peso_cono - cono) < 0.01);

    // Buscar precio EDSA aproximado para este (ancho, cono, PB)
    const priceMatch = findClosestEDSAPrice(preciosEDSA, ancho, cono, pb);

    options.push({
      cono,
      pn,
      pb,
      rollos_por_tarima: rule?.total_rollos ?? 0,
      pz_por_cama: rule?.pz_por_cama ?? 0,
      camas_por_tarima: rule?.camas_por_tarima ?? 0,
      catalog_match: exactMatch
        ? {
            codigo_alterno: exactMatch.codigo_alterno,
            largo_real: exactMatch.largo_real,
            largo_aprox: exactMatch.largo_aprox,
          }
        : null,
      precio_estimado_mxn_kg: priceMatch?.precio_mxn_kg ?? null,
      is_exact_catalog_match: !!exactMatch,
    });
  }
  return options;
}

// === Lookup de precio dado (ancho, cono, PB, resin_class) ===

// Busca el match por PB usando semantica de INTERVALO (floor).
// Los precios en el Excel de Diego representan rangos: el row PB=2.90 cubre
// pesos [2.90, 3.00), el row 3.00 cubre [3.00, 3.10), etc.
// Por eso si el usuario cotiza PB=2.96 debe tomar el row de PB=2.90 (no 3.00).
// La logica anterior tomaba "el mas cercano" lo cual rompia esta convencion.
export function lookupPrice(params: {
  ancho: number;
  cono: number;
  pb: number;
  resin_class: ResinClass;
  product_type?: ProductType;
  preciosEDSA: ParsedPriceRow[];
  preciosColor: ParsedPriceRow[];
}): PriceLookupResult | null {
  const { ancho, cono, pb, resin_class, product_type = 'manual', preciosEDSA, preciosColor } = params;

  // El archivo a usar depende del resin_class
  const universe =
    resin_class === 'virgen'
      ? preciosEDSA
      : preciosColor.length > 0
        ? preciosColor
        : preciosEDSA;

  // Filtrar al subconjunto relevante (tolerar ancho 19.7 ≈ 20)
  const anchoTol = 0.5;
  let candidates = universe.filter(
    (r) =>
      Math.abs(r.ancho - ancho) <= anchoTol &&
      Math.abs(r.cono - cono) < 0.01 &&
      (resin_class === 'virgen'
        ? r.resin_class === 'virgen'
        : r.resin_class === resin_class || r.resin_class === 'color'),
  );

  // Filtrar product_type si fue especificado, pero abrir si no hay matches
  const byType = candidates.filter((r) => r.product_type === product_type);
  if (byType.length > 0) candidates = byType;

  // Priorizar match exacto de ancho
  const exactAncho = candidates.filter((c) => c.ancho === ancho);
  if (exactAncho.length > 0) candidates = exactAncho;

  if (candidates.length === 0) return null;

  // Semantica de INTERVALO (floor): tomar el row con PB <= target mas alto.
  // Ej: target=2.96 → entre [2.90, 3.00) → row PB=2.90.
  // Tolerancia: 0.005 para que PB=3.00 match el row 3.00 (no caiga al 2.90).
  const FLOOR_TOLERANCE = 0.005;
  const lowerOrEqual = candidates.filter((c) => c.peso_total <= pb + FLOOR_TOLERANCE);

  let best: ParsedPriceRow;
  let bestDistance: number;

  if (lowerOrEqual.length > 0) {
    // Tomar el de PB MAS ALTO entre los <= target (el inmediatamente abajo)
    best = lowerOrEqual.reduce((acc, c) => (c.peso_total > acc.peso_total ? c : acc));
    bestDistance = Math.abs(best.peso_total - pb);
  } else {
    // Fallback: ningun row con PB <= target. Tomar el de menor PB disponible.
    // (Caso edge: el producto es mas pequeño que cualquier row del Excel)
    best = candidates.reduce((acc, c) => (c.peso_total < acc.peso_total ? c : acc));
    bestDistance = Math.abs(best.peso_total - pb);
  }

  // Calidad del match
  let match_quality: 'exact' | 'close' | 'interpolated' = 'interpolated';
  if (bestDistance < 0.02) match_quality = 'exact';
  else if (bestDistance < 0.1) match_quality = 'close';

  return {
    precio_mxn_kg: best.precio_mxn_kg,
    source_file: best.source_file,
    source_sheet: best.source_sheet,
    resin_class: best.resin_class,
    product_type: best.product_type,
    raw_description: best.raw_description,
    master_mxn_kg: best.master_mxn_kg,
    intenso_mxn_kg: best.intenso_mxn_kg,
    match_quality,
    match_distance_pb: bestDistance,
  };
}

// Helper interno: busca el precio EDSA con semantica de intervalo (floor PB).
// Acepta cualquier product_type para no perder Auto/Semi/HP cuando aplican.
function findClosestEDSAPrice(
  preciosEDSA: ParsedPriceRow[],
  ancho: number,
  cono: number,
  pb: number,
): ParsedPriceRow | null {
  const anchoTol = 0.5; // tolerar 19.7 ≈ 20
  const candidates = preciosEDSA.filter(
    (r) => Math.abs(r.ancho - ancho) <= anchoTol && Math.abs(r.cono - cono) < 0.01,
  );
  if (candidates.length === 0) return null;
  // Priorizar exact ancho match si lo hay
  const exactAncho = candidates.filter((c) => c.ancho === ancho);
  const pool = exactAncho.length > 0 ? exactAncho : candidates;

  // Floor: tomar el row con PB <= target mas alto
  const FLOOR_TOLERANCE = 0.005;
  const lowerOrEqual = pool.filter((c) => c.peso_total <= pb + FLOOR_TOLERANCE);
  if (lowerOrEqual.length > 0) {
    return lowerOrEqual.reduce((acc, c) => (c.peso_total > acc.peso_total ? c : acc));
  }
  // Fallback: ningun row con PB <= target. Tomar el de menor PB.
  return pool.reduce((acc, c) => (c.peso_total < acc.peso_total ? c : acc));
}

// === Helper unificado para auto-llenar el LineItemEditor ===

export interface AutoFillResult {
  cono: number;
  rollos_por_tarima: number;
  pz_por_cama: number;
  camas_por_tarima: number;
  costo_base_mxn_kg: number;
  master_mxn_kg: number;
  intenso_mxn_kg: number;
  source_note: string;
  match_quality: 'exact' | 'close' | 'interpolated';
  warnings: string[];
}

// Dada la elección final del vendedor, devuelve TODO lo necesario para auto-llenar
export function buildAutoFill(params: {
  ancho: number;
  calibre: number;
  largo_ft: number;
  cono: number;
  resin_class: ResinClass;
  product_type?: ProductType;
  preciosEDSA: ParsedPriceRow[];
  preciosColor: ParsedPriceRow[];
  rangos: ParsedTarimaRange[];
}): AutoFillResult | null {
  const { ancho, calibre, largo_ft, cono, resin_class, product_type, preciosEDSA, preciosColor, rangos } = params;
  const pn = calcPN(ancho, largo_ft, calibre);
  const pb = pn + cono;

  const price = lookupPrice({
    ancho,
    cono,
    pb,
    resin_class,
    product_type,
    preciosEDSA,
    preciosColor,
  });

  const rule = findTarimaRule(rangos, ancho, pb);
  const warnings: string[] = [];

  if (!price) {
    warnings.push(`No encontre precio para ${ancho}" cono=${cono} PB=${pb.toFixed(2)} ${resin_class}`);
    return null;
  }
  if (price.match_quality === 'interpolated') {
    warnings.push(`Match aproximado (PB diff ${price.match_distance_pb.toFixed(2)}kg) — verificar con Diego`);
  }
  if (!rule) {
    warnings.push(`No encontre regla de tarima para ${ancho}" PB=${pb.toFixed(2)}`);
  }

  return {
    cono,
    rollos_por_tarima: rule?.total_rollos ?? 0,
    pz_por_cama: rule?.pz_por_cama ?? 0,
    camas_por_tarima: rule?.camas_por_tarima ?? 0,
    costo_base_mxn_kg: price.precio_mxn_kg,
    master_mxn_kg: price.master_mxn_kg ?? 0,
    intenso_mxn_kg: price.intenso_mxn_kg ?? 0,
    source_note: `${price.source_file}/${price.source_sheet} - ${price.raw_description}`,
    match_quality: price.match_quality,
    warnings,
  };
}
