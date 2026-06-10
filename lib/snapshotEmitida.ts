// Construcción del snapshot inmutable de una cotización emitida.
//
// Cuando el vendedor genera el PDF al cliente o la PO a Extruidos, queremos
// preservar el estado COMPLETO del cálculo en ese momento: inputs, precios,
// TC, items, trailers, warnings detectados, totales. Como JSONB.
//
// La idea es que dos semanas después se pueda reconstruir EXACTAMENTE lo
// que se envió, aunque Diego haya subido precios EDSA nuevos, aunque el
// vendedor haya editado el draft, aunque haya migraciones del schema.
//
// `schemaVersion` permite evolucionar el formato del snapshot sin romper
// la lectura de snapshots viejos.

import type { LineItem, Trailer, TipoCotizacion, Empresa, Moneda } from '@/types';
import type { QuoteResult } from './computeQuote';

// Versión actual del schema del snapshot.
// Incrementar cuando se agregue/quite un campo de los inputs guardados.
// Los snapshots viejos retienen su schemaVersion original — al leerlos
// hay que poder interpretar versiones distintas.
// v2 (v1.22): agrega tipoCotizacion + aprobacion al meta.
export const SNAPSHOT_SCHEMA_VERSION = 2;

// Registro de aprobación cuando la cotización tocó una spec crítica
// (hoy: reducción de material > 5%, política Diego 10-jun-2026) en modo 'optimizada_revision'.
export interface AprobacionInfo {
  aprobadoPor: string;   // nombre que el vendedor capturó
  aprobadoEn: string;    // ISO timestamp del momento de aprobación
}

export interface SnapshotMeta {
  cliente: string;
  contacto?: string;
  direccion?: string;
  vendedor: string;
  fecha: string;      // formato del PDF: 'en-US' locale
  numero: string;
  tc: number;
  // Suma del flete asignado a trailers con items (excluye fantasmas)
  transportUSDActivo: number;
  // Modo con el que se emitió + aprobación (si aplicó). Historial: queda
  // registrado qué opción se usó y quién aprobó.
  tipoCotizacion: TipoCotizacion;
  aprobacion?: AprobacionInfo | null;
  // Empresa/moneda con la que se emitió — discriminador para que el histórico
  // no mezcle pesos y dólares al reportar tc/transporte/totales.
  empresa: Empresa;
  moneda: Moneda;
}

export interface Snapshot {
  schemaVersion: number;
  snapshotAt: string;       // ISO timestamp del momento de generación
  meta: SnapshotMeta;
  items: LineItem[];
  trailers: Trailer[];
  // El árbol completo de cálculo (perItem, perTrailer, totals, warnings)
  quote: QuoteResult;
}

// Arma el snapshot a partir del estado actual del cotizador.
// NOTA: usa una fecha ISO recibida desde fuera porque algunos contextos
// (tests, replay) necesitan controlar el timestamp. En producción se
// pasa `new Date().toISOString()` desde el handler.
export function buildSnapshot(params: {
  items: LineItem[];
  trailers: Trailer[];
  quote: QuoteResult;
  meta: SnapshotMeta;
  snapshotAt: string;
}): Snapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    snapshotAt: params.snapshotAt,
    meta: params.meta,
    items: params.items,
    trailers: params.trailers,
    quote: params.quote,
  };
}

// Serialización canónica del snapshot para hashing.
// JSON.stringify normal no garantiza orden de claves estable entre
// implementaciones — para que el hash sea reproducible, ordenamos las
// claves recursivamente.
export function canonicalize(value: unknown): string {
  const seen = new WeakSet<object>();
  function serialize(v: unknown): unknown {
    if (v === null) return null;
    // Normalizar números no finitos (NaN, Infinity, -Infinity). JSON.stringify
    // los convierte a 'null' silenciosamente, así que dos snapshots con un NaN
    // donde el otro tiene null serializarían igual sin querer. Los mapeamos a
    // un marcador explícito y estable para que el hash los distinga.
    if (typeof v === 'number' && !Number.isFinite(v)) {
      return `__nonfinite__${String(v)}`;
    }
    if (typeof v !== 'object') return v;
    if (seen.has(v as object)) return '[circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(serialize);
    const obj = v as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = serialize(obj[key]);
    }
    return sorted;
  }
  return JSON.stringify(serialize(value));
}

// SHA-256 hex del snapshot canonicalizado. Usa la WebCrypto API que
// está disponible tanto en Node.js (runtime='nodejs') como en Edge runtime.
export async function hashSnapshot(snapshot: Snapshot): Promise<string> {
  const canonical = canonicalize(snapshot);
  const buf = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}
