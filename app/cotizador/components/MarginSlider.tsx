'use client';

import { MARGIN_MIN } from '@/lib/pricingEngine';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

// Slider de margen objetivo. Default 0% - 50%, paso 0.5%
export default function MarginSlider({
  value,
  onChange,
  min = 0,
  max = 0.5,
  step = 0.005,
}: Props) {
  const minPct = ((MARGIN_MIN - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
          Margen objetivo (markup)
        </span>
        <span className="mono text-2xl font-semibold text-bnp-green">
          {(value * 100).toFixed(1)}%
        </span>
      </div>

      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        {/* Marca del mínimo (12%) */}
        <div
          className="absolute top-0 -translate-y-1 w-px h-3 bg-bnp-amber pointer-events-none"
          style={{ left: `${minPct}%` }}
          aria-label="Mínimo aceptable 12%"
        />
      </div>

      <div className="flex justify-between text-2xs text-text-muted mono">
        <span>0%</span>
        <span className="text-bnp-amber" style={{ marginLeft: `${minPct - 8}%` }}>
          12% mín
        </span>
        <span>50%</span>
      </div>
    </div>
  );
}
