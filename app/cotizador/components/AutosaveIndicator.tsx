'use client';

import { Loader2, AlertCircle, Cloud, RefreshCw } from 'lucide-react';
import type { AutosaveStatus } from '@/lib/useCotizacionAutosave';

interface Props {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  errorMessage: string | null;
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'recién';
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours}h`;
}

export default function AutosaveIndicator({ status, lastSavedAt, errorMessage }: Props) {
  if (status === 'idle' && !lastSavedAt) return null;

  // Conflicto multi-tab: el draft cambió en otra pestaña/dispositivo.
  // Dejamos de autoguardar y ofrecemos recargar para no pisar el otro trabajo.
  if (status === 'conflict') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-2xs text-bnp-red font-medium"
        title={errorMessage ?? ''}
      >
        <AlertCircle className="w-3 h-3" />
        Cambió en otra pestaña
        <button
          onClick={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-bnp-red/40 hover:bg-bnp-red/10 transition-colors"
        >
          <RefreshCw className="w-2.5 h-2.5" />
          Recargar
        </button>
      </span>
    );
  }

  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs text-text-secondary">
        <Loader2 className="w-3 h-3 animate-spin" />
        Guardando…
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-2xs text-bnp-amber"
        title={errorMessage ?? ''}
      >
        <AlertCircle className="w-3 h-3" />
        Error al guardar
      </span>
    );
  }

  if (status === 'saved' && lastSavedAt) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-2xs text-text-muted"
        title={`Última copia guardada: ${lastSavedAt.toLocaleTimeString('es-MX')}`}
      >
        <Cloud className="w-3 h-3 text-bnp-green" />
        Guardado {timeSince(lastSavedAt)}
      </span>
    );
  }

  return null;
}
