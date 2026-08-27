// Carga de datos parseados (precompilados con scripts/build-static-data.ts).
// Estrategia stale-while-revalidate en 3 capas:
//   1. Memoria (módulo): misma instancia para todos los consumers de la sesión.
//   2. localStorage: el último dataset bueno de Supabase hidrata la UI AL
//      INSTANTE en cargas frías (TTL 24h) mientras se revalida en background.
//   3. Red: /api/data/current (vigente de Diego) → fallback precios.json.
// Los precios son confidenciales: el cache local se limpia al cerrar sesión
// (clearPriceCache desde useAuth.signOut) y expira solo a las 24h.

import { useEffect, useState } from 'react';
import type {
  ParsedPriceRow,
  ParsedTarimaRow,
  ParsedTarimaRange,
} from './parsers/types';

export interface PriceData {
  generated_at: string;
  source_files: {
    edsa: string;
    color: string;
    tarima: string;
    productos_edsa?: string;       // OPCIONAL: tabla maestra de SKUs EDSA
  };
  precios_edsa: ParsedPriceRow[];
  precios_color: ParsedPriceRow[];
  catalogo_tarima: ParsedTarimaRow[];
  rangos_tarima: ParsedTarimaRange[];
  // Tabla maestra de productos EDSA (catalogo completo de SKUs reales).
  // Sirve como segundo universo de sugerencia de cono cuando el catalogo
  // de tarima (subconjunto filtrado) no tiene match para un (ancho, calibre).
  productos_edsa?: ParsedTarimaRow[];
  stats: Record<string, number>;
  // De donde vienen los datos:
  //   'supabase'     = vigentes que subio Diego (lo normal).
  //   'static'       = no hay datos en Supabase todavia (204) → JSON del build. OK.
  //   'static-error' = Supabase respondio ERROR (500/timeout/sesion) → caemos al
  //                    build PERO son precios de respaldo posiblemente viejos:
  //                    la UI debe advertirlo (antes esto se caía en silencio).
  source?: 'supabase' | 'static' | 'static-error';
}

let _cache: PriceData | null = null;
let _loadingPromise: Promise<PriceData | null> | null = null;

// === Suscripción: los consumers se enteran cuando llegan datos frescos ===
type Listener = () => void;
const _listeners = new Set<Listener>();

function notifyListeners(): void {
  _listeners.forEach((l) => l());
}

export function subscribePriceData(listener: Listener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

// === Capa localStorage (solo datasets 'supabase', TTL 24h) ===
const CACHE_KEY = 'sice_price_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readLocalCache(): PriceData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; data: PriceData };
    if (!parsed?.data?.generated_at) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeLocalCache(data: PriceData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Quota excedida o storage bloqueado: seguir sin cache local.
  }
}

// Borra el cache local Y el de memoria. Llamar al cerrar sesión (los precios
// son confidenciales y no deben sobrevivir en un equipo compartido).
export function clearPriceCache(): void {
  _cache = null;
  _loadingPromise = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
  }
}

// Limpia el cache y recarga en background, notificando a los consumers
// suscritos (usePriceData) cuando llegan los datos frescos. Usar después de
// subir un archivo nuevo desde el admin — sin window.location.reload().
export function invalidatePriceData(): void {
  clearPriceCache();
  void loadPriceData();
}

// Fetch real (sin mirar cache de memoria). Actualiza memoria + localStorage
// y notifica a los suscriptores.
async function fetchFresh(): Promise<PriceData | null> {
  // ¿Supabase respondió un ERROR real (no un simple "no hay datos")? Si sí,
  // el fallback estático son precios de respaldo posiblemente viejos y hay
  // que advertirlo, no caer en silencio.
  let supabaseError = false;
  // 1) Primero intentar Supabase (datos vigentes que Diego subio desde el admin)
  try {
    const res = await fetch('/api/data/current', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as PriceData;
      data.source = 'supabase';
      _cache = data;
      writeLocalCache(data);
      notifyListeners();
      return data;
    }
    // 204 = no hay datos en Supabase (esperado en primer arranque). Cualquier
    // OTRO status (500 RLS/timeout, 401 sesión) es un error: caer al estático
    // pero marcarlo como 'static-error'.
    if (res.status !== 204) {
      supabaseError = true;
      // eslint-disable-next-line no-console
      console.error('[dataStore] /api/data/current respondió', res.status, '— usando precios de respaldo (build)');
    }
  } catch (err) {
    supabaseError = true;
    // eslint-disable-next-line no-console
    console.error('[dataStore] /api/data/current inaccesible, usando precios de respaldo:', err);
  }

  // 2) Fallback: JSON estatico precompilado en build time. NO se persiste en
  //    localStorage (es respaldo, no debe pisar un dataset bueno de Supabase).
  try {
    const res = await fetch('/data/precios.json', { cache: 'force-cache' });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('[dataStore] precios.json no disponible:', res.status);
      return null;
    }
    const data = (await res.json()) as PriceData;
    data.source = supabaseError ? 'static-error' : 'static';
    _cache = data;
    notifyListeners();
    return data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[dataStore] error cargando precios.json:', err);
    return null;
  }
}

// Singleton loader. Cualquier consumer obtiene la misma instancia.
export async function loadPriceData(): Promise<PriceData | null> {
  if (_cache) return _cache;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = fetchFresh().finally(() => {
    _loadingPromise = null;
  });
  return _loadingPromise;
}

// React hook: { data, loading, error }.
// Hidrata SÍNCRONO desde memoria o localStorage (la UI pinta al instante,
// sin flash de "cargando") y revalida contra la red en background; solo
// re-renderiza si el dataset realmente cambió (generated_at/source).
export function usePriceData(): {
  data: PriceData | null;
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<{
    data: PriceData | null;
    loading: boolean;
    error: string | null;
  }>(() => {
    if (_cache) return { data: _cache, loading: false, error: null };
    const local = readLocalCache();
    if (local) return { data: local, loading: false, error: null };
    return { data: null, loading: true, error: null };
  });

  useEffect(() => {
    let cancelled = false;

    const apply = (d: PriceData | null) => {
      if (cancelled) return;
      setState((s) => {
        if (d) {
          const same =
            s.data && s.data.generated_at === d.generated_at && s.data.source === d.source;
          return same ? { ...s, loading: false, error: null } : { data: d, loading: false, error: null };
        }
        // Sin datos frescos: conservar lo que haya (cache local) antes que borrar.
        return s.data ? s : { data: null, loading: false, error: 'No se cargó precios.json' };
      });
    };

    // Revalidar siempre en background (aunque hayamos hidratado del cache).
    loadPriceData().then(apply).catch((err) => {
      if (!cancelled) {
        setState((s) => (s.data ? s : { data: null, loading: false, error: String(err) }));
      }
    });

    // Datos nuevos empujados por invalidatePriceData() (p.ej. admin subió Excel).
    const unsubscribe = subscribePriceData(() => {
      if (_cache) apply(_cache);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}
