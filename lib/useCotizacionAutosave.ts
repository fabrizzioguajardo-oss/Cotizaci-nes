// Auto-save del draft de cotización del usuario.
//
// Funcionamiento:
//   - Recibe el estado completo de la cotización
//   - Cada vez que algo cambia, espera 2 segundos (debounce) y guarda
//   - Si el user cambia más cosas durante el debounce, reinicia el timer
//   - Si el guardado falla, reintenta automáticamente en el próximo cambio
//   - Expone status: 'idle' | 'saving' | 'saved' | 'error' para UI feedback

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { LineItem, Trailer } from '@/types';

// 'conflict' = otra pestaña/dispositivo guardó el mismo draft. Dejamos de
// autoguardar para no pisar ese trabajo; el usuario debe recargar.
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export interface AutosaveState {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  errorMessage: string | null;
  draftId: string | null;
}

export interface AutosaveControls {
  // Forzar un save inmediato (sin esperar debounce)
  saveNow: () => Promise<void>;
  // Borrar el draft actual (botón "Nueva cotización")
  clearDraft: () => Promise<void>;
  // Cargar el draft existente del usuario
  loadDraft: () => Promise<DraftPayload | null>;
}

export interface DraftPayload {
  id: string;
  cliente: string;
  contacto?: string | null;
  direccion?: string | null;
  tc: number;
  transport_usd: number;
  items: LineItem[];
  trailers?: Trailer[] | null;
}

interface UseCotizacionAutosaveParams {
  cliente: string;
  contacto?: string;
  direccion?: string;
  tc: number;
  transport_usd: number;
  total_revenue_usd: number;
  total_cost_usd: number;
  utilidad_global: number | null;
  items: LineItem[];
  trailers: Trailer[];
  // Si está enabled=false, NO autosaves (útil al cargar inicialmente)
  enabled?: boolean;
  // Delay del debounce (default 2000ms)
  debounceMs?: number;
}

export function useCotizacionAutosave(
  params: UseCotizacionAutosaveParams,
): AutosaveState & AutosaveControls {
  const { enabled = true, debounceMs = 2000 } = params;

  const [state, setState] = useState<AutosaveState>({
    status: 'idle',
    lastSavedAt: null,
    errorMessage: null,
    draftId: null,
  });

  // Refs para timer y para acceder al estado más reciente sin re-renders.
  // draftIdRef evita recrear saveDraft cuando draftId cambia (lo que causaría
  // un save "fantasma" 2s después de cada save real).
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const draftIdRef = useRef<string | null>(null);
  // updated_at que el servidor reportó en el último save/load exitoso.
  // Se manda como base del optimistic lock en cada POST.
  const lastUpdatedAtRef = useRef<string | null>(null);
  // Una vez en conflicto, dejamos de autoguardar hasta que el usuario
  // recargue. Evita un loop de 409s y proteje el trabajo de la otra pestaña.
  const conflictRef = useRef<boolean>(false);

  // Función que realmente hace el POST. Callback estable (deps vacías) - lee
  // params y draftId siempre de refs, así no se recrea en cada render.
  const saveDraft = useCallback(async (): Promise<void> => {
    // Si ya estamos en conflicto, no intentamos guardar más — el usuario
    // tiene que recargar para resolverlo.
    if (conflictRef.current) return;

    const p = paramsRef.current;
    setState((s) => ({ ...s, status: 'saving', errorMessage: null }));

    try {
      const res = await fetch('/api/cotizaciones/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draftIdRef.current,
          base_updated_at: lastUpdatedAtRef.current,
          cliente: p.cliente,
          contacto: p.contacto ?? '',
          direccion: p.direccion ?? '',
          tc: p.tc,
          transport_usd: p.transport_usd,
          total_revenue_usd: p.total_revenue_usd,
          total_cost_usd: p.total_cost_usd,
          utilidad_global: p.utilidad_global,
          items: p.items,
          trailers: p.trailers,
        }),
      });

      const data = await res.json();

      // 409 = otra pestaña/dispositivo ya modificó el draft. Entramos en
      // modo conflicto: dejamos de autoguardar y avisamos al usuario.
      if (res.status === 409 || data.conflict) {
        conflictRef.current = true;
        setState((s) => ({
          ...s,
          status: 'conflict',
          errorMessage:
            data.error ||
            'El borrador cambió en otra pestaña. Recarga para ver la versión más reciente.',
        }));
        return;
      }

      if (!res.ok || !data.saved) {
        setState((s) => ({
          ...s,
          status: 'error',
          errorMessage: data.error || `HTTP ${res.status}`,
        }));
        return;
      }

      // Actualizar refs antes de setState para que el próximo save tenga el
      // id y el updated_at correctos (base del próximo optimistic check).
      const newId = data.id ?? draftIdRef.current;
      draftIdRef.current = newId;
      if (data.updated_at) lastUpdatedAtRef.current = data.updated_at;

      setState((s) => ({
        ...s,
        status: 'saved',
        lastSavedAt: new Date(),
        draftId: newId,
        errorMessage: null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'unknown error',
      }));
    }
  }, []);

  // Trigger autosave con debounce cuando cualquier campo cambia
  useEffect(() => {
    if (!enabled) return;
    if (conflictRef.current) return; // en conflicto: no autoguardar

    // No guardar si la cotización está completamente vacía (cliente vacío + items todos en 0)
    const isEmpty =
      !params.cliente.trim() &&
      params.items.length === 1 &&
      params.items[0].aCliente === 0 &&
      params.items[0].calCliente === 0 &&
      params.items[0].lCliente === 0 &&
      params.items[0].precioCliente === 0;

    if (isEmpty) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveDraft();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Re-trigger solo cuando cambian campos del usuario - saveDraft es estable
    // (deps vacías), así que no hace falta incluirlo aquí.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    debounceMs,
    params.cliente,
    params.contacto,
    params.direccion,
    params.tc,
    params.transport_usd,
    params.total_revenue_usd,
    params.total_cost_usd,
    params.utilidad_global,
    JSON.stringify(params.items),
    JSON.stringify(params.trailers),
  ]);

  // Save manual inmediato (sin debounce)
  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await saveDraft();
  }, [saveDraft]);

  // Borrar el draft
  const clearDraft = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await fetch('/api/cotizaciones/draft', { method: 'DELETE' });
      draftIdRef.current = null;
      lastUpdatedAtRef.current = null;
      conflictRef.current = false;
      setState({ status: 'idle', lastSavedAt: null, errorMessage: null, draftId: null });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[autosave] clearDraft falló:', err);
    }
  }, []);

  // Cargar draft existente
  const loadDraft = useCallback(async (): Promise<DraftPayload | null> => {
    try {
      const res = await fetch('/api/cotizaciones/draft', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.draft) return null;

      draftIdRef.current = data.draft.id;
      // Guardar el updated_at del servidor como base del optimistic lock.
      lastUpdatedAtRef.current = data.draft.updated_at ?? null;
      conflictRef.current = false;
      setState((s) => ({
        ...s,
        draftId: data.draft.id,
        lastSavedAt: new Date(data.draft.updated_at ?? data.draft.created_at ?? Date.now()),
        status: 'saved',
      }));

      return {
        id: data.draft.id,
        cliente: data.draft.cliente ?? '',
        contacto: data.draft.contacto ?? '',
        direccion: data.draft.direccion ?? '',
        tc: data.draft.tc ?? 0,
        transport_usd: data.draft.transport_usd ?? 0,
        items: data.draft.items ?? [],
        trailers: data.draft.trailers ?? null,
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[autosave] loadDraft falló:', err);
      return null;
    }
  }, []);

  return { ...state, saveNow, clearDraft, loadDraft };
}
