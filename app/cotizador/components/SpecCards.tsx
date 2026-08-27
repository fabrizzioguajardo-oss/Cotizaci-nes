'use client';

import type { LineItem, CalcResult } from '@/types';
import { fmtNum } from '@/lib/format';
import { Scale, Box, Layers, Truck } from 'lucide-react';
import Tooltip from './Tooltip';
import { GLOSARIO } from '@/lib/glosario';

interface Props {
  item: LineItem;
  result: CalcResult;
}

// Cards visibles arriba de la seccion de costos.
// Resumen rapido del item: pesos, rollos, kilos por tarima, kilos del item.
// Se actualiza en vivo al cambiar cualquier input.
export default function SpecCards({ item, result }: Props) {
  const rollos_total = item.rollosPallet * item.palletTrailer;
  const kg_neto_tarima = result.pnReal * item.rollosPallet;
  const kg_bruto_tarima = result.pbReal * item.rollosPallet;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {/* Peso neto / Peso bruto (por rollo) */}
      <div className="card p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Scale className="w-3.5 h-3.5 text-bnp-cyan" />
          <p className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
            Peso del rollo
          </p>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-baseline justify-between">
            <span className="text-2xs text-text-muted">
              <Tooltip content={GLOSARIO.pn} underline>PN (neto)</Tooltip>
            </span>
            <span className="mono text-sm font-semibold">
              {fmtNum(result.pnReal, 3)} <span className="text-2xs text-text-muted">kg</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xs text-text-muted">
              <Tooltip content={GLOSARIO.pb} underline>PB (bruto)</Tooltip>
            </span>
            <span className="mono text-sm font-semibold">
              {fmtNum(result.pbReal, 3)} <span className="text-2xs text-text-muted">kg</span>
            </span>
          </div>
        </div>
      </div>

      {/* Kilos por tarima */}
      <div className="card p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Layers className="w-3.5 h-3.5 text-bnp-purple" />
          <p className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
            Kilos por tarima
          </p>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-baseline justify-between">
            <span className="text-2xs text-text-muted">Neto</span>
            <span className="mono text-sm font-semibold">
              {fmtNum(kg_neto_tarima, 1)} <span className="text-2xs text-text-muted">kg</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xs text-text-muted">Bruto</span>
            <span className="mono text-sm font-semibold">
              {fmtNum(kg_bruto_tarima, 1)} <span className="text-2xs text-text-muted">kg</span>
            </span>
          </div>
        </div>
      </div>

      {/* Total rollos del item */}
      <div className="card p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Box className="w-3.5 h-3.5 text-bnp-green" />
          <p className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
            Total rollos
          </p>
        </div>
        <p className="mono text-lg font-semibold">{fmtNum(rollos_total, 0)}</p>
        <p className="text-2xs text-text-muted mono">
          {item.rollosPallet}/tarima × {item.palletTrailer} tarimas
        </p>
      </div>

      {/* KG total del item en el trailer */}
      <div className="card p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Truck className="w-3.5 h-3.5 text-bnp-amber" />
          <p className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
            KG total item
          </p>
        </div>
        <p className="mono text-lg font-semibold">
          {fmtNum(result.kgNetoItem, 1)} <span className="text-2xs text-text-muted">kg</span>
        </p>
        <p className="text-2xs text-text-muted">
          {fmtNum(result.kgNetoItem * 2.20462, 0)} lb netos
        </p>
      </div>
    </div>
  );
}
