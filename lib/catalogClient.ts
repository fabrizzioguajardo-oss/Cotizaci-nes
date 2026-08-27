// Cliente del catalogo en el navegador.
// Si Supabase no esta configurado, cae a localStorage para que la app
// siga funcionando en modo offline / demo.

import type { CostCatalogEntry, CostCategory } from '@/types';

const LS_KEY = 'sice_cost_catalog_v1';

function readLocal(): CostCatalogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(entries: CostCatalogEntry[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

// === Cache de módulo (stale-while-revalidate, TTL 5 min) ===
// Cambiar entre las 8 tabs del admin o abrir el picker YA NO re-descarga la
// categoría cada vez: se sirve el cache al instante y se revalida si caducó.
const CATALOG_TTL_MS = 5 * 60 * 1000;
const _catalogCache = new Map<string, { entries: CostCatalogEntry[]; fetchedAt: number }>();

function cacheKey(category?: CostCategory): string {
  return category ?? '__all__';
}

// Invalida una categoría (o todo) — la llaman saveEntry/deleteEntry.
export function invalidateCatalog(category?: CostCategory): void {
  if (category) {
    _catalogCache.delete(category);
    _catalogCache.delete('__all__');
  } else {
    _catalogCache.clear();
  }
}

// Lectura sincrónica del cache (para pintar al instante mientras se revalida).
export function peekCatalog(category?: CostCategory): CostCatalogEntry[] | null {
  const hit = _catalogCache.get(cacheKey(category));
  return hit ? hit.entries : null;
}

async function fetchCatalog(category?: CostCategory): Promise<CostCatalogEntry[]> {
  try {
    const url = category ? `/api/catalog?category=${category}` : '/api/catalog';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('api error');
    const data = await res.json();
    if (data.entries && data.entries.length > 0) return data.entries;
    // Si la API responde vacio (Supabase no configurado), fallback a localStorage
    const local = readLocal().filter((e) => e.vigente);
    return category ? local.filter((e) => e.category === category) : local;
  } catch {
    const local = readLocal().filter((e) => e.vigente);
    return category ? local.filter((e) => e.category === category) : local;
  }
}

// Carga entradas vigentes (opcionalmente filtradas por categoria).
// Sirve cache fresco si existe; si está caducado lo devuelve igual pero
// dispara revalidación en background (onFresh notifica si algo cambió).
export async function loadCatalog(
  category?: CostCategory,
  onFresh?: (entries: CostCatalogEntry[]) => void,
): Promise<CostCatalogEntry[]> {
  const key = cacheKey(category);
  const hit = _catalogCache.get(key);
  if (hit) {
    if (Date.now() - hit.fetchedAt > CATALOG_TTL_MS) {
      void fetchCatalog(category).then((fresh) => {
        _catalogCache.set(key, { entries: fresh, fetchedAt: Date.now() });
        onFresh?.(fresh);
      });
    }
    return hit.entries;
  }
  const entries = await fetchCatalog(category);
  _catalogCache.set(key, { entries, fetchedAt: Date.now() });
  return entries;
}

export async function saveEntry(entry: CostCatalogEntry): Promise<CostCatalogEntry> {
  invalidateCatalog(entry.category);
  try {
    const res = await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    if (data.saved && data.entry) return data.entry;
  } catch {}
  // fallback local
  const all = readLocal();
  // marcar anteriores con mismo nombre+categoria como obsoletas
  const updated = all.map((e) =>
    e.category === entry.category && e.name === entry.name && e.vigente
      ? { ...e, vigente: false }
      : e,
  );
  const newEntry = {
    ...entry,
    id: entry.id ?? `local-${Date.now()}`,
    vigente: true,
    created_at: new Date().toISOString(),
  };
  updated.push(newEntry);
  writeLocal(updated);
  return newEntry;
}

export async function deleteEntry(id: string): Promise<void> {
  invalidateCatalog();
  try {
    await fetch(`/api/catalog?id=${id}`, { method: 'DELETE' });
  } catch {}
  // fallback local
  const all = readLocal();
  const updated = all.map((e) => (e.id === id ? { ...e, vigente: false } : e));
  writeLocal(updated);
}

// Helper para calcular caja blanca on-the-fly:
// MXN/kg = caja_mxn / (PN_real_kg * rollos_caja)
export function calcCajaBlancoKg(
  caja_mxn: number,
  pn_real_kg: number,
  rollos_caja: number,
): number {
  if (pn_real_kg <= 0 || rollos_caja <= 0) return 0;
  return caja_mxn / (pn_real_kg * rollos_caja);
}
