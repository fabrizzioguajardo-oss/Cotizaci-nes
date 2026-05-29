'use client';

import type { LineItem, SuggestionResult } from '@/types';
import type { SuggestionDiagnosis } from '@/lib/pricingEngine';
import { fmtNum, fmtPct, fmtUSD } from '@/lib/format';
import { AlertTriangle, CheckCircle, ArrowRight, Package } from 'lucide-react';

interface Props {
  item: LineItem;
  suggestion: SuggestionResult | null;
  // Diagnóstico cuando suggestion es null — explica al vendedor qué falta
  // en vez del genérico "ingresa precio". Cubre el caso del Adversario:
  // costoTotalKg ≤ 1 MXN/kg retorna null silencioso = sales blocker invisible.
  diagnosis?: SuggestionDiagnosis;
  // Cono efectivo a mostrar: el override que el vendedor escogio entre las
  // alternativas, o la sugerencia del algoritmo si no hay override. Permite
  // previsualizar el PB resultante con el cono seleccionado sin escribirlo
  // a item.cono (que dispararia el bucle de "el cono suma").
  conoEfectivo?: number;
  onApply: () => void;
  onPickAlternative?: (cono: number) => void;
}

// Tarjeta principal de Tab 2: muestra el spec sugerido para la planta
export default function SuggestionCard({ item, suggestion, diagnosis, conoEfectivo, onApply, onPickAlternative }: Props) {
  if (!suggestion) {
    return (
      <div className="card p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-bnp-amber/15 flex items-center justify-center text-bnp-amber flex-shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold mb-1">No puedo sugerir todavía</h3>
            {diagnosis && diagnosis.missing.length > 0 ? (
              <>
                <p className="text-2xs text-text-secondary mb-2">
                  Para calcular la sugerencia me falta:
                </p>
                <ul className="text-2xs text-text-secondary space-y-1 mb-2">
                  {diagnosis.missing.map((m, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-bnp-amber mt-0.5">•</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-2xs text-text-muted">
                  Llena estos campos en Tab Pedido o en el sidebar y la sugerencia aparece sola.
                </p>
              </>
            ) : (
              <p className="text-2xs text-text-secondary">
                Ingresa precio del cliente y costo base para ver la sugerencia.
              </p>
            )}
          </div>
        </div>
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

  // Cono final: override del vendedor o sugerencia. PB final se recalcula
  // contra el cono final para que la tarjeta muestre lo que de verdad se
  // entregaria si se aplica.
  const conoFinal = conoEfectivo ?? suggestion.conoSugerido;
  const pbFinal = suggestion.pnReal + conoFinal;
  const pbDiffFinal = pbFinal - suggestion.pbCliente;

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
            <p className="mono text-sm text-text-secondary mb-2">{item.calCliente} GA</p>
            <div className="pt-2 mt-2 border-t border-bnp-cyan/20 text-2xs">
              <div className="flex justify-between text-text-secondary">
                <span>Cono cliente:</span>
                <span className="mono text-text-primary">{fmtNum(item.conoCliente ?? item.cono, 3)} kg</span>
              </div>
              <div className="flex justify-between text-text-secondary mt-0.5">
                <span>PB esperado:</span>
                <span className="mono text-bnp-cyan font-semibold">{fmtNum(suggestion.pbCliente, 2)} kg</span>
              </div>
            </div>
          </div>

          {/* Realmente fabricar */}
          <div className="border border-bnp-green/40 bg-bnp-green/5 rounded-lg p-4">
            <p className="text-2xs font-semibold text-bnp-green uppercase tracking-wider mb-2">
              Realmente fabricar
            </p>
            <p className="mono text-2xl font-semibold mb-1">
              {item.aReal}″ × {suggestion.lReal}′
            </p>
            <p className="mono text-sm text-text-secondary mb-2">{item.calReal} GA</p>
            <div className="pt-2 mt-2 border-t border-bnp-green/20 text-2xs">
              <div className="flex justify-between text-text-secondary">
                <span>{conoFinal !== suggestion.conoSugerido ? 'Cono escogido:' : 'Cono sugerido:'}</span>
                <span className="mono text-bnp-green font-semibold">
                  {fmtNum(conoFinal, 3)} kg
                  <span className="text-text-muted ml-1">(+{fmtNum(conoFinal - (item.conoCliente ?? item.cono), 2)})</span>
                </span>
              </div>
              <div className="flex justify-between text-text-secondary mt-0.5">
                <span>PB resultante:</span>
                <span className="mono text-bnp-green font-semibold">{fmtNum(pbFinal, 2)} kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card explicativa: cono compensation */}
        <div className="mt-4 p-3 rounded-md bg-bnp-purple/5 border border-bnp-purple/20">
          <div className="flex items-start gap-2">
            <Package className="w-3.5 h-3.5 text-bnp-purple mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-2xs font-semibold text-bnp-purple uppercase tracking-wider mb-1">
                Compensación de cono — para mantener el peso bruto cercano al esperado
              </p>
              <p className="text-2xs text-text-secondary">
                Al reducir el largo, el rollo pesaría {fmtNum(suggestion.pbCliente - suggestion.pnReal, 2)} kg
                menos del PB que el cliente espera. Subiendo el cono de{' '}
                <span className="mono text-text-primary">{fmtNum(item.conoCliente ?? item.cono, 2)} kg</span> a{' '}
                <span className="mono text-bnp-green font-semibold">{fmtNum(conoFinal, 2)} kg</span>,
                el paquete final pesa{' '}
                <span className="mono text-text-primary">{fmtNum(pbFinal, 2)} kg</span>
                {' '}({pbDiffFinal >= 0 ? '+' : ''}
                {fmtNum(pbDiffFinal, 2)} kg vs lo esperado,{' '}
                <span style={{ color: Math.abs(pbDiffFinal) < 0.1 ? '#5BAA47' : '#F59E0B' }}>
                  {Math.abs(suggestion.pbCliente > 0 ? pbDiffFinal / suggestion.pbCliente * 100 : 0).toFixed(1)}%
                </span>).
              </p>
              <p className="text-2xs text-text-muted mt-1">
                Cono ideal exacto: {fmtNum(suggestion.conoIdeal, 3)} kg (no es tamaño estándar, sugiero el más cercano sin exceder).
              </p>

              {/* Opciones alternativas de cono.
                  isCurrent compara contra conoFinal (que respeta el override
                  del vendedor) — no contra suggestion.conoSugerido. Asi el
                  boton seleccionado refleja la elección real del usuario. */}
              {suggestion.conosAlternativos.length > 1 && onPickAlternative && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-2xs text-text-muted">Otras opciones:</span>
                  {suggestion.conosAlternativos.map((c) => {
                    const isCurrent = Math.abs(c - conoFinal) < 0.001;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onPickAlternative(c)}
                        disabled={isCurrent}
                        className={`px-2 py-0.5 rounded mono text-2xs font-semibold transition-colors ${
                          isCurrent
                            ? 'bg-bnp-green/20 text-bnp-green border border-bnp-green/40 cursor-default'
                            : 'bg-bg-surface text-text-secondary border border-border-subtle hover:border-border'
                        }`}
                      >
                        {fmtNum(c, 2)} kg
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
