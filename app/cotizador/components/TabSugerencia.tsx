'use client';

import { useMemo, useState } from 'react';
import type { LineItem, CalcResult } from '@/types';
import { suggestRealSpec, sumAdders, MARGIN_MIN } from '@/lib/pricingEngine';
import MarginSlider from './MarginSlider';
import SuggestionCard from './SuggestionCard';
import RealSpecEditor from './RealSpecEditor';
import ToleranceWarning from './ToleranceWarning';
import { fmtUSD, fmtNum, fmtPct } from '@/lib/format';

interface Props {
  item: LineItem;
  result: CalcResult;
  onChange: (patch: Partial<LineItem>) => void;
  onGenerateQuote: () => void;
  onGeneratePO: () => void;
}

// Tab 2 - Sugerencia para planta
// Aquí vive la innovación: el algoritmo inverso que despeja largo real
// para alcanzar el margen objetivo dado el precio del cliente.
export default function TabSugerencia({
  item,
  result,
  onChange,
  onGenerateQuote,
  onGeneratePO,
}: Props) {
  const [marginTarget, setMarginTarget] = useState(MARGIN_MIN);

  // Recalcular sugerencia en tiempo real al mover el slider
  const suggestion = useMemo(() => {
    const costoBaseTotal = item.costoBase + sumAdders(item) + result.cajaBlancoKg;
    return suggestRealSpec({
      precio: item.precioCliente,
      tc: 18, // viene del global, pero ya está embebido en transpKgMXN
      transpKgMXN: result.transpKgMXN,
      costoBaseTotal,
      aCliente: item.aCliente,
      calCliente: item.calCliente,
      lCliente: item.lCliente,
      aReal: item.aReal,
      calReal: item.calReal,
      cono: item.cono,
      marginTarget,
    });
  }, [item, result, marginTarget]);

  // Aplicar sugerencia completa: largo real + cono sugerido (compensación PB)
  const handleApply = () => {
    if (suggestion) {
      onChange({
        lReal: suggestion.lReal,
        cono: suggestion.conoSugerido,
      });
    }
  };

  // Vendedor escoge un cono alternativo de los estándar mostrados
  const handlePickAlternativeCono = (cono: number) => {
    if (suggestion) {
      onChange({
        lReal: suggestion.lReal,
        cono,
      });
    }
  };

  const pricePerLbColor =
    suggestion && (suggestion.pricePerLb < 0.85 || suggestion.pricePerLb > 1.6)
      ? '#F59E0B'
      : '#5BAA47';

  return (
    <div className="space-y-4">
      {/* Slider grande de margen objetivo */}
      <div className="card p-5">
        <MarginSlider value={marginTarget} onChange={setMarginTarget} />

        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border-subtle">
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-wider">Precio cliente</p>
            <p className="mono text-base font-semibold mt-0.5">
              {fmtUSD(item.precioCliente)}
            </p>
          </div>
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-wider">Costo actual / rollo</p>
            <p className="mono text-base font-semibold mt-0.5">
              {fmtUSD(result.costoRolloUSD)}
            </p>
          </div>
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-wider">Utilidad actual</p>
            <p
              className="mono text-base font-semibold mt-0.5"
              style={{
                color:
                  result.utilidad === null
                    ? '#64748B'
                    : result.utilidad < 0
                    ? '#EF4444'
                    : result.utilidad < MARGIN_MIN
                    ? '#F59E0B'
                    : '#5BAA47',
              }}
            >
              {fmtPct(result.utilidad)}
            </p>
          </div>
        </div>
      </div>

      {/* Tarjeta de sugerencia */}
      <SuggestionCard
        item={item}
        suggestion={suggestion}
        onApply={handleApply}
        onPickAlternative={handlePickAlternativeCono}
      />

      {/* Warning de tolerancia de produccion: compara el largo declarado al
          cliente contra el largo real (sugerido o manual) y avisa si excede
          la tolerancia natural de la planta (±0.5%) */}
      <ToleranceWarning
        largoCliente={item.lCliente}
        largoReal={suggestion?.lReal ?? item.lReal}
      />

      {/* Editor manual del spec real */}
      <RealSpecEditor item={item} onChange={onChange} />

      {/* Acciones finales: generar PDFs */}
      <div className="card p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
          Generar documentos
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onGenerateQuote} className="btn-primary">
            Cotización al cliente (PDF)
          </button>
          <button onClick={onGeneratePO} className="btn-purple">
            PO para Extruidos (PDF)
          </button>
        </div>
        <p className="text-2xs text-text-muted mt-3">
          La cotización usa el <span className="text-bnp-cyan">spec declarado</span> ({item.aCliente}″ × {item.calCliente}GA × {item.lCliente}′).
          El PO usa el <span className="text-bnp-green">spec real</span> ({item.aReal}″ × {item.calReal}GA × {item.lReal}′).
        </p>
      </div>
    </div>
  );
}
