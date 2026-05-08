'use client';

import type { LineItem } from '@/types';

interface Props {
  item: LineItem;
  onChange: (patch: Partial<LineItem>) => void;
}

// Editor del spec real (Tab 2). Permite ajuste manual cuando la sugerencia
// del algoritmo no es exactamente lo que se quiere mandar a planta.
export default function RealSpecEditor({ item, onChange }: Props) {
  const num = (key: keyof LineItem) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ [key]: parseFloat(e.target.value) || 0 } as Partial<LineItem>);

  return (
    <div className="card p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Ajuste manual del spec real
      </h4>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="label">Ancho real (in)</label>
          <input
            type="number" step="0.1"
            value={item.aReal || ''}
            onChange={num('aReal')}
            className="input input-green"
          />
        </div>
        <div>
          <label className="label">Calibre real (GA)</label>
          <input
            type="number" step="1"
            value={item.calReal || ''}
            onChange={num('calReal')}
            className="input input-green"
          />
        </div>
        <div>
          <label className="label">Largo real (ft)</label>
          <input
            type="number" step="10"
            value={item.lReal || ''}
            onChange={num('lReal')}
            className="input input-green"
          />
        </div>
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
