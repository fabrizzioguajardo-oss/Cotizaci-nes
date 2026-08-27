'use client';

import type { CalcResult } from '@/types';
import { marginStatus } from '@/lib/pricingEngine';
import { fmtUSD, fmtNum, fmtPct } from '@/lib/format';
import Tooltip from './Tooltip';
import { GLOSARIO } from '@/lib/glosario';

interface Props {
  result: CalcResult;
  precioCliente: number;
}

// Tira horizontal de métricas calculadas en tiempo real
export default function ResultsStrip({ result, precioCliente }: Props) {
  const status = marginStatus(result.utilidad);

  const cells: Array<{ label: string; value: string; color?: string; sub?: string; tip?: string }> = [
    {
      label: 'Costo / rollo',
      value: fmtUSD(result.costoRolloUSD),
      sub: `${fmtNum(result.costoRolloMXN)} MXN`,
      tip: GLOSARIO.costo,
    },
    {
      label: 'Precio / rollo',
      value: fmtUSD(precioCliente),
      sub: `${fmtNum(result.pnTeoricoClienteLbs, 1)} lbs decl.`,
    },
    {
      label: 'Utilidad',
      value: fmtPct(result.utilidad),
      color: status.color,
      sub: status.level === 'ok' ? 'OK' : status.label.split(' ')[0],
      tip: GLOSARIO.utilidad,
    },
    {
      label: 'Price / lb',
      value: fmtUSD(result.pricePerLb, 3),
      sub: 'entregado',
      tip: GLOSARIO.price_lb,
    },
    {
      label: 'PN real',
      value: `${fmtNum(result.pnReal, 3)} kg`,
      sub: `${fmtNum(result.pnReal * 2.20462, 2)} lb`,
      tip: GLOSARIO.pn,
    },
    {
      label: 'Reducción',
      value: fmtPct(result.materialReduction),
      sub: 'vs decl.',
      tip: GLOSARIO.reduccion,
      // Política Diego: ámbar arriba del 5% (pide aprobación), rojo arriba
      // del 10% (fuera del ideal).
      color:
        result.materialReduction > 0.10
          ? '#EF4444'
          : result.materialReduction > 0.05
          ? '#F59E0B'
          : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-border-subtle rounded-lg overflow-hidden border border-border-subtle">
      {cells.map((c, i) => (
        <div key={i} className="bg-bg-elevated p-3">
          <p className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
            {c.tip ? (
              <Tooltip content={c.tip} underline>
                {c.label}
              </Tooltip>
            ) : (
              c.label
            )}
          </p>
          <p
            className="mono text-lg font-semibold mt-1"
            style={{ color: c.color || '#E6EDF3' }}
          >
            {c.value}
          </p>
          {c.sub && (
            <p className="text-2xs text-text-muted mono mt-0.5">{c.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
