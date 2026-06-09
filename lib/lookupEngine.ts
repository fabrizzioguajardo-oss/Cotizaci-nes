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

import { calcPNFacturable } from './pricingEngine';
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

// Deriva el resin_class del lookup a partir del tipo de resina + color del
// LineItem. UN SOLO lugar para esta regla — antes vivía duplicada y divergente
// en ConeSelectorPanel (preview, ignoraba tipoColor) y en LineItemEditor
// (apply, sí consideraba tipoColor), causando que el precio previsualizado
// no coincidiera con el aplicado para producto virgen con color.
export function deriveResinClass(
  tipoResina: ResinClass | 'virgen' | 'reciclado' | 'color',
  tipoColor?: string,
): ResinClass {
  if (tipoResina === 'reciclado') return 'reciclado';
  if (tipoResina === 'color') return 'color';
  // virgen + cualquier color que no sea clear (incluye custom) = se cotiza
  // como color (lleva master). Misma regla que usaba el apply en LineItemEditor.
  if (tipoColor && tipoColor !== 'clear') return 'color';
  return 'virgen';
}

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
//
// Cada opción incluye un precio_estimado que ahora respeta el resin_class
// del producto (virgen busca en EDSA, color busca en Color, etc.) para que
// el preview no muestre $47 cuando el real va a ser $36.
//
// Universos de busqueda (en orden de preferencia):
//   1. catalogo (tarima Filtros) — SKUs filtrados por Diego, incluye reglas de tarima
//   2. productosEDSA (tabla maestra) — universo completo de SKUs EDSA, fallback cuando
//      tarima no tiene match para el (ancho, calibre) pero EDSA si fabrica algo similar
//   3. preciosEDSA (precios) — ultimo recurso, deduce conos del archivo de precios
export function lookupConoOptions(params: {
  ancho: number;
  calibre: number;
  largo_ft: number;
  catalogo: ParsedTarimaRow[];
  rangos: ParsedTarimaRange[];
  preciosEDSA: ParsedPriceRow[];
  preciosColor?: ParsedPriceRow[];   // OPCIONAL para retro-compat
  productosEDSA?: ParsedTarimaRow[]; // OPCIONAL: tabla maestra de productos EDSA
  resin_class?: ResinClass;          // OPCIONAL: si se pasa, preview usa el universo correcto
  color?: string;                    // OPCIONAL: filter de color para preview
}): ConoOption[] {
  const {
    ancho, calibre, largo_ft, catalogo, rangos, preciosEDSA,
    preciosColor = [], productosEDSA = [], resin_class = 'virgen', color,
  } = params;
  // PN facturable (truncado), igual que en costo/factura. Antes el preview
  // usaba calcPN crudo, así que cerca de un borde de intervalo de precio el
  // PB del preview caía en un row distinto al que cobra el costo real.
  const pn = calcPNFacturable(ancho, largo_ft, calibre);

  // 1) Catalogo tarima (subconjunto curado, con reglas de tarima)
  let conos = uniqueConosFor(catalogo, ancho, calibre);

  // 2) Fallback: tabla maestra de productos EDSA. Cubre productos que EDSA
  //    fabrica pero que aun no estan en el catalogo de Tarima/Filtros (el
  //    documento de rollos por tarima es un subset). Esto evita que el panel
  //    de cono salga vacio cuando el vendedor cotiza un spec que EDSA si
  //    tiene en su SAP pero que no aparece en el archivo de tarima.
  if (conos.length === 0 && productosEDSA.length > 0) {
    conos = uniqueConosFor(productosEDSA, ancho, calibre);
  }

  // 3) Ultimo recurso: deducir conos del universo de precios — incluye TODOS
  //    los product_types (manual, semi, auto, hp...) para no perder los
  //    machine films / auto products.
  if (conos.length === 0) {
    const universe = new Set<number>();
    // Tolerar pequeño mismatch en ancho (19.7 ≈ 20)
    const anchoTol = 0.5;
    for (const r of preciosEDSA) {
      if (Math.abs(r.ancho - ancho) <= anchoTol) universe.add(r.cono);
    }
    conos = Array.from(universe).sort((a, b) => a - b);
  }

  // 4) Para cada cono, calcular PB y reglas de tarima.
  //    Buscamos match exacto primero en el catalogo tarima (preferido por
  //    tener largo_real); si no, en productosEDSA (sin largo_real pero con
  //    codigo_alterno util). Asi conservamos el codigo del SKU aunque venga
  //    de la tabla maestra.
  const options: ConoOption[] = [];
  for (const cono of conos) {
    const pb = pn + cono;
    const rule = findTarimaRule(rangos, ancho, pb);
    let exactMatch = findCatalogMatches(catalogo, {
      ancho,
      calibre,
      pn,
      pnTolerance: 0.1,
    }).find((c) => Math.abs(c.peso_cono - cono) < 0.01);
    if (!exactMatch && productosEDSA.length > 0) {
      // Match por ancho/calibre/CONO solamente — SIN filtrar por PN. El
      // peso_neto de la tabla maestra corresponde al largo de fábrica del SKU
      // EDSA (otro largo que el cotizado), así que comparar contra el PN del
      // cliente casi nunca caía dentro de la tolerancia y se perdía el
      // codigo_alterno, anulando el motivo de consultar la maestra.
      exactMatch = findCatalogMatches(productosEDSA, {
        ancho,
        calibre,
      }).find((c) => Math.abs(c.peso_cono - cono) < 0.01);
    }

    // Buscar precio en el universo correcto (color o EDSA segun resin_class).
    // Antes solo miraba EDSA → mostraba ~$47 cuando el producto era color
    // (que en realidad cuesta ~$36-50). Ahora respeta el resin_class.
    const priceMatch = lookupPrice({
      ancho, cono, pb,
      resin_class,
      color,
      preciosEDSA, preciosColor,
    });

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
  color?: string;             // NUEVO: 'orange', 'black', 'clear', etc.
  product_type?: ProductType;
  preciosEDSA: ParsedPriceRow[];
  preciosColor: ParsedPriceRow[];
}): PriceLookupResult | null {
  const { ancho, cono, pb, resin_class, color, product_type = 'manual', preciosEDSA, preciosColor } = params;

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
      // Coincidencia de resina ESTRICTA por clase. Antes el caso no-virgen
      // aceptaba `=== resin_class || === 'color'`, así que un lookup de
      // RECICLADO podía traer una fila 'color' (con master, ~$45 vs ~$30) y
      // cotizar de más. Ahora: virgen→virgen, reciclado→reciclado, color→color.
      (resin_class === 'virgen'
        ? r.resin_class === 'virgen'
        : resin_class === 'reciclado'
          ? r.resin_class === 'reciclado'
          : r.resin_class === 'color'),
  );

  // Filtrar product_type si fue especificado, pero abrir si no hay matches
  const byType = candidates.filter((r) => r.product_type === product_type);
  if (byType.length > 0) candidates = byType;

  // Filtrar por color si fue especificado. El parser de Color guarda
  // r.color = 'orange'/'black'/etc o 'generic' (cuando la hoja no especifica
  // un color particular). 'clear' no es color con master → no filtra.
  if (color && color !== 'clear') {
    const byGeneric = candidates.filter((r) => r.color === 'generic' || r.color === null);
    if (color === 'custom') {
      // 'custom' no tiene un row de color propio en el catálogo. Antes NO se
      // filtraba nada, así que el mejor match podía caer en un master de un
      // color arbitrario (orange/black/...) y dar un precio engañoso. Ahora
      // preferimos los rows genéricos (sin color específico).
      if (byGeneric.length > 0) candidates = byGeneric;
    } else {
      const byColor = candidates.filter((r) => r.color === color);
      if (byColor.length > 0) candidates = byColor;
      else if (byGeneric.length > 0) candidates = byGeneric;
      // else: mantener candidates como están
    }
  }

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
  color?: string;             // tipoColor del LineItem: 'orange', 'black', 'clear', etc.
  product_type?: ProductType;
  preciosEDSA: ParsedPriceRow[];
  preciosColor: ParsedPriceRow[];
  rangos: ParsedTarimaRange[];
}): AutoFillResult | null {
  const { ancho, calibre, largo_ft, cono, resin_class, color, product_type, preciosEDSA, preciosColor, rangos } = params;
  // PN facturable (truncado) para que el PB que busca el precio coincida con
  // el que se cobra en costo. Consistente con lookupConoOptions.
  const pn = calcPNFacturable(ancho, largo_ft, calibre);
  const pb = pn + cono;

  const price = lookupPrice({
    ancho,
    cono,
    pb,
    resin_class,
    color,
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
