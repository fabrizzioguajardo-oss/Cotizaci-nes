// Único entry point de cálculo para una cotización completa.
// Garantiza que los DOS PDFs (cotización al cliente + PO a EDSA) salgan
// del mismo árbol de resultados — su paridad subyacente es la razón de
// existir de SICE. Cualquier consumidor (UI, PDFs, snapshot) debe pasar
// por aquí.
//
// Además agrega warnings ejecutables sobre las invariantes de negocio
// que hoy viven en comentarios:
//   - PB_real nunca debe exceder PB_cliente (cono compensatorio)
//   - utilidad >= 12% (margen mínimo)
//   - kgNetoTotal de un trailer <= 19,200 kg
//
// El test offline `scripts/verify-pdf-parity.ts` verifica que ningún caso
// real viole estas invariantes. La UI también las lee para mostrar
// advertencias al vendedor antes de descargar el PDF.

import type { LineItem, Trailer, CalcResult } from '@/types';
import {
  calcAllTrailerTotals,
  calcLineItem,
  conoEsperado,
  MARGIN_MIN,
  TRAILER_MAX_KG,
  type TrailerSummary,
} from './pricingEngine';

// Trailers que no llevan ninguna línea pero tienen flete > 0. Inyectan
// "flete fantasma" al PDF al cliente porque el global de `transport_usd`
// suma todos los trailers. Bug detectado por el Adversario.
function detectarFletesFantasma(
  trailers: Trailer[],
  items: LineItem[],
): Trailer[] {
  const conItems = new Set(items.map((it) => it.trailerId));
  return trailers.filter((t) => !conItems.has(t.id) && t.transport_usd > 0);
}

// Categorías de advertencias de invariantes
export type WarningCode =
  | 'pb_excedido'           // PB_real > PB_cliente (compensación de cono falló)
  | 'margen_bajo'           // utilidad < MARGIN_MIN
  | 'margen_perdida'        // utilidad < 0 (pierde dinero)
  | 'capacidad_excedida'    // trailer.kgNetoTotal > TRAILER_MAX_KG
  | 'flete_fantasma'        // trailer vacío con transport_usd > 0 — caso del Adversario
  | 'logistica_cero'        // rollosPallet × palletTrailer = 0 → kg/costo en cero
  | 'sin_precio'            // precioCliente = 0 (cotización incompleta)
  | 'pn_cero';              // pnReal = 0 (spec inválido)

export interface QuoteWarning {
  level: 'error' | 'warn';
  code: WarningCode;
  itemId?: number;
  trailerId?: number;
  message: string;
  // Valores numéricos relevantes para diagnóstico (los muestra el test offline)
  values?: Record<string, number>;
}

export interface QuoteResult {
  // Resultados por línea, mismo orden que items.
  perItem: CalcResult[];
  // Resúmenes por trailer.
  perTrailer: TrailerSummary[];
  // Totales globales (suma de todos los trailers).
  totals: {
    revenueUSD: number;
    costUSD: number;
    utilidadGlobal: number | null;
    kgNetoTotal: number;
    unidadesTotales: number;
  };
  // Warnings agregados — el test offline los verifica como assertions, la UI
  // los muestra como alertas antes de generar el PDF.
  warnings: QuoteWarning[];
}

// Tolerancia para comparar PB_real vs PB_cliente. 0.5% del PB del cliente
// para evitar falsos positivos de floating point (el cap del pricingEngine
// ya garantiza que conoSugerido <= PB_cliente - PN_real, pero la
// truncación a 2 decimales puede dejar diferencias de ~0.001 kg).
const PB_FLOAT_TOLERANCE_PCT = 0.005;

// Calcula la cotización completa. Único entry point.
export function computeQuote(
  items: LineItem[],
  trailers: Trailer[],
  tc: number,
): QuoteResult {
  // 1) Resúmenes por trailer (incluye kg neto, capacidad, revenue/cost)
  const trailerTotals = calcAllTrailerTotals(items, trailers, tc);

  // 2) Resultado por línea — re-usa los kg y flete del trailer correspondiente
  //    para que coincida con lo que calcAllTrailerTotals computó internamente.
  const perItem: CalcResult[] = items.map((item) => {
    const summary = trailerTotals.perTrailer.find((t) => t.trailerId === item.trailerId);
    const trailer = trailers.find((t) => t.id === item.trailerId);
    const kgTrailer = summary?.kgNetoTotal ?? 0;
    const transportTrailer = trailer?.transport_usd ?? 0;
    return calcLineItem(item, tc, transportTrailer, kgTrailer);
  });

  // 3) Detectar violaciones de invariantes
  const warnings = detectWarnings(items, perItem, trailerTotals.perTrailer);

  // 4) Trailers fantasma (sin items pero con flete > 0)
  for (const t of detectarFletesFantasma(trailers, items)) {
    warnings.push({
      level: 'warn',
      code: 'flete_fantasma',
      trailerId: t.id,
      message:
        `Trailer ${t.id} ${t.destino ? `(${t.destino}) ` : ''}` +
        `no lleva ninguna línea pero tiene flete $${t.transport_usd.toFixed(0)} USD asignado. ` +
        `Bórralo o asignale una línea — de lo contrario el flete fantasma se le cobra al cliente.`,
      values: { transport_usd: t.transport_usd },
    });
  }

  return {
    perItem,
    perTrailer: trailerTotals.perTrailer,
    totals: {
      revenueUSD: trailerTotals.totalRevenueUSD,
      costUSD: trailerTotals.totalCostUSD,
      utilidadGlobal: trailerTotals.utilidadGlobal,
      kgNetoTotal: trailerTotals.kgNetoTotal,
      unidadesTotales: trailerTotals.unidadesTotales,
    },
    warnings,
  };
}

// Verifica las invariantes ejecutables y produce warnings.
// Esta función es el corazón de la red de seguridad — el test offline la
// usa indirectamente vía computeQuote() para validar casos reales.
function detectWarnings(
  items: LineItem[],
  results: CalcResult[],
  perTrailer: TrailerSummary[],
): QuoteWarning[] {
  const warnings: QuoteWarning[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = results[i];

    // === Invariante 1: PB_real ≤ PB_cliente ===
    // El cono compensatorio nunca debe inflar el peso bruto arriba del
    // declarado al cliente.
    // CRÍTICO: pbCliente usa conoCliente (el cono ORIGINAL que el cliente
    // espera), NO item.cono (el cono real, posiblemente subido por
    // compensación). Antes ambos lados usaban item.cono y el término se
    // cancelaba — el chequeo se reducía a pnReal>pnTeoricoCliente y era
    // estructuralmente incapaz de detectar sobrecompensación de cono (que es
    // exactamente lo que esta invariante existe para vigilar). Fallback a
    // item.cono para drafts viejos migrados que aún no tienen conoCliente.
    // conoCliente puede venir en 0 por dos razones: (a) draft viejo migrado
    // que nunca tuvo el campo, (b) el vendedor no llenó el cono del cliente.
    // En ambos casos un cono de 0 NO es un "cono esperado" real (los conos
    // físicos son >= 0.1 kg), así que caemos al cono real del item. El `??`
    // no bastaba: solo atrapa null/undefined, no el 0 — dejaba pbCliente
    // subvaluado y disparaba un pb_excedido falso-positivo.
    const conoClienteEf = conoEsperado(item.conoCliente, item.cono);
    const pbCliente = result.pnTeoricoClienteKg + conoClienteEf;
    const pbReal = result.pbReal;
    if (pbCliente > 0) {
      const tolerance = pbCliente * PB_FLOAT_TOLERANCE_PCT;
      if (pbReal > pbCliente + tolerance) {
        warnings.push({
          level: 'error',
          code: 'pb_excedido',
          itemId: item.id,
          trailerId: item.trailerId,
          message:
            `Línea ${item.id}: PB real (${pbReal.toFixed(3)} kg) excede el PB esperado por el cliente (${pbCliente.toFixed(3)} kg). ` +
            `El cliente va a pesar ${(pbReal - pbCliente).toFixed(3)} kg de más al recibir — revisar cono o largo real.`,
          values: { pbReal, pbCliente, exceso: pbReal - pbCliente, tolerance },
        });
      }
    }

    // === Invariante 2: utilidad ≥ MARGIN_MIN ===
    // Margen abajo del 12% requiere aprobación. La regla está documentada
    // en CLAUDE.md pero hoy no se enforce en ningún lado.
    if (result.utilidad !== null && item.precioCliente > 0) {
      if (result.utilidad < 0) {
        warnings.push({
          level: 'error',
          code: 'margen_perdida',
          itemId: item.id,
          trailerId: item.trailerId,
          message:
            `Línea ${item.id}: margen ${(result.utilidad * 100).toFixed(1)}% — la cotización está vendiendo abajo del costo (pérdida de $${(result.costoRolloUSD - item.precioCliente).toFixed(2)} USD por unidad).`,
          values: { utilidad: result.utilidad, minimo: MARGIN_MIN },
        });
      } else if (result.utilidad < MARGIN_MIN) {
        warnings.push({
          level: 'warn',
          code: 'margen_bajo',
          itemId: item.id,
          trailerId: item.trailerId,
          message:
            `Línea ${item.id}: margen ${(result.utilidad * 100).toFixed(1)}% está bajo el mínimo de ${(MARGIN_MIN * 100).toFixed(0)}%. Requiere aprobación.`,
          values: { utilidad: result.utilidad, minimo: MARGIN_MIN },
        });
      }
    }

    // === Invariante 3: spec inválido (PN cero) ===
    // Línea con cantidad pero sin spec real produce PDFs sin sentido.
    if (item.precioCliente > 0 && result.pnReal === 0) {
      warnings.push({
        level: 'error',
        code: 'pn_cero',
        itemId: item.id,
        trailerId: item.trailerId,
        message:
          `Línea ${item.id}: tiene precio pero no spec real (ancho/calibre/largo). El PDF saldría con un rollo de peso cero.`,
      });
    }

    // === Invariante 4: cotización incompleta (sin precio) ===
    // Solo warning — el vendedor puede estar guardando un draft a medias.
    if (item.precioCliente === 0 && result.pnReal > 0) {
      warnings.push({
        level: 'warn',
        code: 'sin_precio',
        itemId: item.id,
        trailerId: item.trailerId,
        message: `Línea ${item.id}: tiene spec pero le falta precio al cliente.`,
      });
    }

    // === Invariante 5: logística en cero ===
    // Si la línea tiene spec y precio pero rollosPallet × palletTrailer = 0,
    // el kg neto y el costo del item salen en CERO sin aviso — y el resumen
    // del trailer reporta utilidad infinita/100%. Pasa típico cuando el cono
    // sugerido viene del fallback de tabla maestra EDSA (sin regla de tarima),
    // así que rollos_por_tarima quedó en 0 y nadie llenó la logística.
    const unidadesLinea = item.rollosPallet * item.palletTrailer;
    if (item.precioCliente > 0 && result.pnReal > 0 && unidadesLinea === 0) {
      warnings.push({
        level: 'error',
        code: 'logistica_cero',
        itemId: item.id,
        trailerId: item.trailerId,
        message:
          `Línea ${item.id}: falta logística (rollos/tarima × tarimas/trailer = 0). ` +
          `El kg neto y el costo salen en cero — llena rollos/tarima y tarimas/trailer.`,
        values: { rollosPallet: item.rollosPallet, palletTrailer: item.palletTrailer },
      });
    }
  }

  // === Invariante 5: capacidad de trailer ===
  for (const t of perTrailer) {
    if (t.exceedsCapacity) {
      warnings.push({
        level: 'error',
        code: 'capacidad_excedida',
        trailerId: t.trailerId,
        message:
          `Trailer ${t.trailerId}: ${t.kgNetoTotal.toFixed(0)} kg netos exceden la capacidad de ${TRAILER_MAX_KG.toLocaleString()} kg. Separa la carga en otro trailer.`,
        values: { kgNeto: t.kgNetoTotal, capacidad: TRAILER_MAX_KG, exceso: t.kgNetoTotal - TRAILER_MAX_KG },
      });
    }
  }

  return warnings;
}

// Helper: separa errores de warnings para que la UI los presente distinto.
export function partitionWarnings(warnings: QuoteWarning[]): {
  errors: QuoteWarning[];
  warns: QuoteWarning[];
} {
  return {
    errors: warnings.filter((w) => w.level === 'error'),
    warns: warnings.filter((w) => w.level === 'warn'),
  };
}

// Helper: resumen humano para mostrar antes de descargar PDF.
export function summarizeWarnings(warnings: QuoteWarning[]): string {
  const { errors, warns } = partitionWarnings(warnings);
  const parts: string[] = [];
  if (errors.length > 0) parts.push(`${errors.length} error${errors.length === 1 ? '' : 'es'}`);
  if (warns.length > 0) parts.push(`${warns.length} advertencia${warns.length === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(', ') : 'sin advertencias';
}
