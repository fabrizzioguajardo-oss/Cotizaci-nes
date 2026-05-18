'use client';

import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { PLANT_TOLERANCE_PCT } from '@/lib/pricingEngine';
import { fmtNum } from '@/lib/format';

interface Props {
  largoCliente: number;     // ft que el cliente ve en la cotizacion
  largoReal: number;        // ft real sugerido por el cotizador o manual
}

// Panel que informa al vendedor sobre la tolerancia natural de produccion de
// la planta vs. la sugerencia actual de spec real.
//
// 3 estados:
//   ✓ DENTRO de tolerancia (verde): la sugerencia cae dentro del rango natural
//     que la planta puede producir. No requiere disclosure especial.
//   ⚠ FUERA de tolerancia (amber): la sugerencia es intencional, ahorra material
//     pero el cliente recibe menos de lo declarado. Vale la pena verificar el
//     contrato.
//   🚫 MUY FUERA (rojo): reducion fuerte (>10pp más allá de tolerancia).
//     Riesgo alto, revisar con Jennifer.
export default function ToleranceWarning({ largoCliente, largoReal }: Props) {
  if (largoCliente <= 0 || largoReal <= 0) return null;

  const tolPct = PLANT_TOLERANCE_PCT;
  const lowerBound = largoCliente * (1 - tolPct);
  const upperBound = largoCliente * (1 + tolPct);
  const reductionAbs = largoCliente - largoReal;
  const reductionPct = (reductionAbs / largoCliente);
  const excedeTolerancia = largoReal < lowerBound;
  const excedeTolerancia_pp = excedeTolerancia ? reductionPct - tolPct : 0;

  // Determinar nivel de warning
  const level: 'ok' | 'warn' | 'danger' = !excedeTolerancia
    ? 'ok'
    : excedeTolerancia_pp > 0.10  // 10pp más allá de la tolerancia
    ? 'danger'
    : 'warn';

  const config = {
    ok: {
      Icon: CheckCircle,
      color: '#5BAA47',
      bg: 'rgba(91, 170, 71, 0.1)',
      border: 'rgba(91, 170, 71, 0.4)',
      title: 'DENTRO de tolerancia de producción',
      desc: `La sugerencia cae en el rango natural que la planta puede producir. No requiere disclosure especial al cliente.`,
    },
    warn: {
      Icon: AlertTriangle,
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.4)',
      title: 'FUERA de tolerancia natural',
      desc: `Esto es una reducción intencional para subir margen. El cliente recibirá menos material del que su PO declara. Confirma que el contrato lo permita.`,
    },
    danger: {
      Icon: AlertTriangle,
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.4)',
      title: 'MUY POR DEBAJO de tolerancia',
      desc: `Reducción agresiva. Riesgo de pérdida de cliente si detecta la diferencia. Considera validar con Jennifer antes de mandar.`,
    },
  }[level];

  const { Icon } = config;

  return (
    <div
      className="card overflow-hidden"
      style={{ borderColor: config.border }}
    >
      <div
        className="px-4 py-3 border-b flex items-center gap-2"
        style={{ backgroundColor: config.bg, borderColor: config.border }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
        <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: config.color }}>
          {config.title}
        </h4>
        <span className="ml-auto text-2xs mono" style={{ color: config.color }}>
          tolerancia: ±{(tolPct * 100).toFixed(1)}%
        </span>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-bg-surface rounded p-3">
            <p className="text-2xs text-text-muted uppercase tracking-wider">Cliente solicitó</p>
            <p className="mono text-base font-semibold mt-0.5">{fmtNum(largoCliente, 0)} ft</p>
          </div>
          <div className="bg-bg-surface rounded p-3">
            <p className="text-2xs text-text-muted uppercase tracking-wider">Rango planta puede producir</p>
            <p className="mono text-base font-semibold mt-0.5">
              {fmtNum(lowerBound, 0)} – {fmtNum(upperBound, 0)} ft
            </p>
            <p className="text-2xs text-text-muted mt-0.5">
              ±{fmtNum(largoCliente * tolPct, 0)} ft variación normal
            </p>
          </div>
          <div className="bg-bg-surface rounded p-3" style={{ borderLeft: `3px solid ${config.color}` }}>
            <p className="text-2xs text-text-muted uppercase tracking-wider">Tu sugerencia</p>
            <p className="mono text-base font-semibold mt-0.5" style={{ color: config.color }}>
              {fmtNum(largoReal, 0)} ft
            </p>
            <p className="text-2xs mt-0.5" style={{ color: config.color }}>
              {reductionAbs >= 0 ? '−' : '+'}{fmtNum(Math.abs(reductionAbs), 0)} ft ({(reductionPct * 100).toFixed(1)}%)
            </p>
          </div>
        </div>

        {/* Banda visual */}
        <div className="relative h-2 bg-bg-surface rounded-full overflow-hidden mb-3">
          {/* Zona de tolerancia (verde) */}
          <div
            className="absolute h-full bg-bnp-green/30"
            style={{
              left: `${((lowerBound - largoCliente * 0.5) / (largoCliente * 0.6)) * 100}%`,
              width: `${((upperBound - lowerBound) / (largoCliente * 0.6)) * 100}%`,
            }}
          />
          {/* Marcador de cliente */}
          <div
            className="absolute top-0 bottom-0 w-px bg-bnp-cyan"
            style={{ left: `${((largoCliente - largoCliente * 0.5) / (largoCliente * 0.6)) * 100}%` }}
            title={`Cliente solicitó: ${largoCliente}ft`}
          />
          {/* Marcador de sugerencia */}
          <div
            className="absolute top-0 bottom-0 w-1"
            style={{
              left: `${((largoReal - largoCliente * 0.5) / (largoCliente * 0.6)) * 100}%`,
              backgroundColor: config.color,
            }}
            title={`Tu sugerencia: ${largoReal}ft`}
          />
        </div>

        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-text-muted" />
          <p className="text-2xs text-text-secondary">
            {config.desc}
            {excedeTolerancia && (
              <span className="text-text-muted">
                {' '}Tu sugerencia está <span className="mono" style={{ color: config.color }}>
                {(excedeTolerancia_pp * 100).toFixed(1)} pp
              </span> por debajo del rango natural.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
