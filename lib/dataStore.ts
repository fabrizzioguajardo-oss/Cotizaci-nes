// Carga de datos parseados (precompilados con scripts/build-static-data.ts).
// El JSON vive en public/data/precios.json y se carga una sola vez al
// iniciar la app, luego se guarda en memoria para todas las cotizaciones.

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

// Limpia el cache para que el proximo loadPriceData() jale datos frescos.
// Usar despues de subir un archivo nuevo desde el admin.
export function invalidatePriceData(): void {
  _cache = null;
  _loadingPromise = null;
}

// Singleton loader. Cualquier consumer obtiene la misma instancia.
export async function loadPriceData(): Promise<PriceData | null> {
  if (_cache) return _cache;
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
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

    // 2) Fallback: JSON estatico precompilado en build time
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
      return data;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[dataStore] error cargando precios.json:', err);
      return null;
    } finally {
      _loadingPromise = null;
    }
  })();

  return _loadingPromise;
}

// React hook: { data, loading, error }
export function usePriceData(): {
  data: PriceData | null;
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<{
    data: PriceData | null;
    loading: boolean;
    error: string | null;
  }>({ data: _cache, loading: !_cache, error: null });

  useEffect(() => {
    if (_cache) {
      setState({ data: _cache, loading: false, error: null });
      return;
    }
    let cancelled = false;
    loadPriceData()
      .then((d) => {
        if (!cancelled) {
          setState({ data: d, loading: false, error: d ? null : 'No se cargó precios.json' });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
