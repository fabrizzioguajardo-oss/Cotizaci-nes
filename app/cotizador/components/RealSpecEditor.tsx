'use client';

import type { LineItem } from '@/types';
import { Lock, Info } from 'lucide-react';

interface Props {
  item: LineItem;
  onChange: (patch: Partial<LineItem>) => void;
}

// Editor del spec REAL (lo que va a la planta).
//
// Reglas del negocio:
//   - Ancho y calibre NUNCA cambian entre spec cliente y spec real.
//     Lo unico que se modifica para ajustar margen es el LARGO.
//   - Por eso ancho y calibre se muestran read-only aqui.
//   - El cono SI puede ajustarse (opcional).
//   - El largo es lo que el vendedor puede editar manualmente, ademas
//     del slider de margen objetivo arriba.
export default function RealSpecEditor({ item, onChange }: Props) {
  const num = (key: keyof LineItem) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ [key]: parseFloat(e.target.value) || 0 } as Partial<LineItem>);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Ajuste manual del spec real
        </h4>
        <p className="text-2xs text-text-muted inline-flex items-center gap-1">
          <Info className="w-3 h-3" />
          Ancho y calibre no cambian, solo el largo (y opcional, el cono)
        </p>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {/* ANCHO: read-only, copia del spec cliente */}
        <div>
          <label className="label inline-flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" />
            Ancho real (in)
          </label>
          <input
            type="number"
            value={item.aReal || ''}
            disabled
            readOnly
            className="input opacity-60 cursor-not-allowed"
            title="El ancho real siempre es igual al ancho declarado al cliente"
          />
        </div>

        {/* CALIBRE: read-only, copia del spec cliente */}
        <div>
          <label className="label inline-flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" />
            Calibre real (GA)
          </label>
          <input
            type="number"
            value={item.calReal || ''}
            disabled
            readOnly
            className="input opacity-60 cursor-not-allowed"
            title="El calibre real siempre es igual al calibre declarado al cliente"
          />
        </div>

        {/* LARGO: editable - este es el unico ajuste manual */}
        <div>
          <label className="label">Largo real (ft)</label>
          <input
            type="number" step="10"
            value={item.lReal || ''}
            onChange={num('lReal')}
            className="input input-green"
          />
        </div>

        {/* CONO: editable - opcional ajustar para diferente PB */}
        <div>
          <label className="label">Cono (kg)</label>
          <input
            type="number" step="0.01"
            value={item.cono || ''}
            onChange={num('cono')}
            className="input input-green"
          />
        </div>
      </div>
    </div>
  );
}
