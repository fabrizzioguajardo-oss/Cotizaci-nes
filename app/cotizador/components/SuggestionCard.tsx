'use client';

import type { LineItem, SuggestionResult } from '@/types';
import { fmtNum, fmtPct, fmtUSD } from '@/lib/format';
import { AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

interface Props {
  item: LineItem;
  suggestion: SuggestionResult | null;
  onApply: () => void;
}

// Tarjeta principal de Tab 2: muestra el spec sugerido para la planta
export default function SuggestionCard({ item, suggestion, onApply }: Props) {
  if (!suggestion) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-text-muted">
          Ingresa precio del cliente y costo base para ver la sugerencia.
        </p>
      </div>
    );
  }

  const reductionColor =
    suggestion.reduction > 0.35
      ? '#EF4444'
      : suggestion.reduction > 0.25
      ? '#F59E0B'
      : '#5BAA47';

  const reductionLabel =
    suggestion.reduction > 0.35
      ? 'Alta'
      : suggestion.reduction > 0.25
      ? 'Media'
      : 'Conservadora';

  return (
    <div className="space-y-4">
      {/* Comparativo principal */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          {suggestion.isValid ? (
            <CheckCircle className="w-4 h-4 text-bnp-green" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-bnp-amber" />
          )}
          <h3 className="text-sm font-semibold">Spec sugerido para Extruidos</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Cliente cree que recibe */}
          <div className="border border-bnp-cyan/30 bg-bnp-cyan/5 rounded-lg p-4">
            <p className="text-2xs font-semibold text-bnp-cyan uppercase tracking-wider mb-2">
              Cliente cree que recibe
            </p>
            <p className="mono text-2xl font-semibold mb-1">
              {item.aCliente}″ × {item.lCliente}′
            </p>
            <p className="mono text-sm text-text-secondary">{item.calCliente} GA</p>
          </div>

          {/* Realmente fabricar */}
          <div className="border border-bnp-green/40 bg-bnp-green/5 rounded-lg p-4">
            <p className="text-2xs font-semibold text-bnp-green uppercase tracking-wider mb-2">
              Realmente fabricar
            </p>
            <p className="mono text-2xl font-semibold mb-1">
              {item.aReal}″ × {suggestion.lReal}′
            </p>
            <p className="mono text-sm text-text-secondary">{item.calReal} GA</p>
          </div>
        </div>

        {/* Reducción visual */}
        <div className="mt-4 pt-4 border-t border-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
              Reducción de material
            </span>
            <span className="mono text-base font-semibold" style={{ color: reductionColor }}>
              {fmtPct(suggestion.reduction)} · {reductionLabel}
            </span>
          </div>
          <div className="relative h-2 bg-bg-surface rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${Math.min(100, suggestion.reduction * 100 / 0.4 * 100)}%`,
                backgroundColor: reductionColor,
              }}
            />
          </div>
          <div className="flex justify-between text-2xs text-text-muted mono mt-1">
            <span>0%</span>
            <span>20%</span>
            <span className="text-bnp-amber">35% lím</span>
          </div>
        </div>

        {/* Métricas detalladas */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-bg-surface rounded-md p-3">
            <p className="text-2xs text-text-muted uppercase tracking-wider">PN real</p>
            <p className="mono text-base font-semibold mt-0.5">
              {fmtNum(suggestion.pnReal, 3)} <span className="text-2xs text-text-muted">kg</span>
            </p>
          </div>
          <div className="bg-bg-surface rounded-md p-3">
            <p className="text-2xs text-text-muted uppercase tracking-wider">PB real</p>
            <p className="mono text-base font-semibold mt-0.5">
              {fmtNum(suggestion.pbReal, 3)} <span className="text-2xs text-text-muted">kg</span>
            </p>
          </div>
          <div className="bg-bg-surface rounded-md p-3">
            <p className="text-2xs text-text-muted uppercase tracking-wider">Price / lb</p>
            <p className="mono text-base font-semibold mt-0.5">
              {fmtUSD(suggestion.pricePerLb, 3)}
            </p>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {suggestion.warnings.length > 0 && (
        <div className="card p-4 border-bnp-amber/40">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-bnp-amber flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-bnp-amber mb-1.5">
                Advertencias
              </p>
              <ul className="space-y-1">
                {suggestion.warnings.map((w, i) => (
                  <li key={i} className="text-2xs text-text-secondary">
                    • {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Botón aplicar */}
      <button
        onClick={onApply}
        className="btn-primary w-full"
        disabled={!suggestion.isValid && suggestion.warnings.length > 2}
      >
        Aplicar sugerencia al spec real
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
