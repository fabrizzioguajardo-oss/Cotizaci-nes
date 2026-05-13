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
import type { LineItem } from '@/types';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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
  tc: number;
  transport_usd: number;
  items: LineItem[];
}

interface UseCotizacionAutosaveParams {
  cliente: string;
  tc: number;
  transport_usd: number;
  total_revenue_usd: number;
  total_cost_usd: number;
  utilidad_global: number | null;
  items: LineItem[];
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

  // Refs para timer y para acceder al estado más reciente sin re-renders
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Función que realmente hace el POST
  const saveDraft = useCallback(async (): Promise<void> => {
    const p = paramsRef.current;
    setState((s) => ({ ...s, status: 'saving', errorMessage: null }));

    try {
      const res = await fetch('/api/cotizaciones/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: state.draftId,
          cliente: p.cliente,
          tc: p.tc,
          transport_usd: p.transport_usd,
          total_revenue_usd: p.total_revenue_usd,
          total_cost_usd: p.total_cost_usd,
          utilidad_global: p.utilidad_global,
          items: p.items,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.saved) {
        setState((s) => ({
          ...s,
          status: 'error',
          errorMessage: data.error || `HTTP ${res.status}`,
        }));
        return;
      }

      setState((s) => ({
        ...s,
        status: 'saved',
        lastSavedAt: new Date(),
        draftId: data.id ?? s.draftId,
        errorMessage: null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'unknown error',
      }));
    }
  }, [state.draftId]);

  // Trigger autosave con debounce cuando cualquier campo cambia
  useEffect(() => {
    if (!enabled) return;

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
    // Re-trigger cuando cualquier campo del state cambia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    debounceMs,
    params.cliente,
    params.tc,
    params.transport_usd,
    params.total_revenue_usd,
    params.total_cost_usd,
    params.utilidad_global,
    JSON.stringify(params.items),
    saveDraft,
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

      setState((s) => ({
        ...s,
        draftId: data.draft.id,
        lastSavedAt: new Date(data.draft.created_at ?? Date.now()),
        status: 'saved',
      }));

      return {
        id: data.draft.id,
        cliente: data.draft.cliente ?? '',
        tc: data.draft.tc ?? 0,
        transport_usd: data.draft.transport_usd ?? 0,
        items: data.draft.items ?? [],
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[autosave] loadDraft falló:', err);
      return null;
    }
  }, []);

  return { ...state, saveNow, clearDraft, loadDraft };
}
