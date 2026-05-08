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

// Carga entradas vigentes (opcionalmente filtradas por categoria)
export async function loadCatalog(category?: CostCategory): Promise<CostCatalogEntry[]> {
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

export async function saveEntry(entry: CostCatalogEntry): Promise<CostCatalogEntry> {
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
