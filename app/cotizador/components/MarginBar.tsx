'use client';

import { marginStatus, MARGIN_MIN } from '@/lib/pricingEngine';

interface Props {
  utilidad: number | null;
  className?: string;
}

// Visualización del margen actual contra el mínimo aceptable
export default function MarginBar({ utilidad, className = '' }: Props) {
  const status = marginStatus(utilidad);
  const u = utilidad ?? 0;

  // Mapear rango -10% a 30% al ancho de la barra
  const minRange = -0.1;
  const maxRange = 0.3;
  const pct = Math.max(0, Math.min(1, (u - minRange) / (maxRange - minRange))) * 100;
  const minMarkPct = ((MARGIN_MIN - minRange) / (maxRange - minRange)) * 100;
  const zeroMarkPct = ((0 - minRange) / (maxRange - minRange)) * 100;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
          Utilidad (markup)
        </span>
        <span className="mono text-sm font-semibold" style={{ color: status.color }}>
          {status.label}
        </span>
      </div>
      <div className="relative h-2.5 bg-bg-surface rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300 rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: status.color,
          }}
        />
        {/* Marca de 0% */}
        <div
          className="absolute top-0 bottom-0 w-px bg-text-muted/40"
          style={{ left: `${zeroMarkPct}%` }}
        />
        {/* Marca de 12% mínimo */}
        <div
          className="absolute top-0 bottom-0 w-px bg-bnp-amber"
          style={{ left: `${minMarkPct}%` }}
        />
      </div>
      <div className="flex justify-between text-2xs text-text-muted mono mt-1">
        <span>-10%</span>
        <span style={{ marginLeft: `${zeroMarkPct - 8}%` }}>0%</span>
        <span style={{ marginLeft: `${minMarkPct - zeroMarkPct - 8}%` }}>12%</span>
        <span>30%</span>
      </div>
    </div>
  );
}
