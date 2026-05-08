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
  };
  precios_edsa: ParsedPriceRow[];
  precios_color: ParsedPriceRow[];
  catalogo_tarima: ParsedTarimaRow[];
  rangos_tarima: ParsedTarimaRange[];
  stats: Record<string, number>;
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
    // 1) Primero intentar Supabase (datos vigentes que Diego subio desde el admin)
    try {
      const res = await fetch('/api/data/current', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as PriceData;
        _cache = data;
        return data;
      }
      // 204 = no hay datos en Supabase, caer al fallback
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[dataStore] /api/data/current falló, intento fallback estatico:', err);
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
