'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LineItem, CalcResult, TipoCotizacion } from '@/types';
import { suggestRealSpec, sumAdders, MARGIN_MIN, diagnoseSuggestion } from '@/lib/pricingEngine';
import MarginSlider from './MarginSlider';
import SuggestionCard from './SuggestionCard';
import ComparisonCard from './ComparisonCard';
import RealSpecEditor from './RealSpecEditor';
import ToleranceWarning from './ToleranceWarning';
import { fmtUSD, fmtNum, fmtPct } from '@/lib/format';
import { Info } from 'lucide-react';

interface Props {
  item: LineItem;
  result: CalcResult;
  directResult: CalcResult | null;   // resultado "fabricar tal cual el cliente"
  tipoCotizacion: TipoCotizacion;
  tc: number;             // tipo de cambio real (global, editable en TopBar)
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
  directResult,
  tipoCotizacion,
  tc,
  onChange,
  onGenerateQuote,
  onGeneratePO,
}: Props) {
  const [marginTarget, setMarginTarget] = useState(MARGIN_MIN);
  // Preview local del cono alternativo escogido por el vendedor.
  // No se commitea a item.cono hasta que pica "Aplicar". De esta forma
  // el algoritmo de compensacion sigue computando contra el cono original
  // del cliente (item.cono) y las alternativas no "se mueven" cada click.
  // Antes: cada click hacia onChange({ cono }) -> item.cono actualizaba ->
  // suggestRealSpec recomputaba conoIdeal = cono + pnReducido -> sugerido
  // subia un escalon -> al volver a clicar el "siguiente" sugerido, todo
  // se desplazaba otro escalon. El vendedor percibia que "el cono suma".
  const [conoOverride, setConoOverride] = useState<number | null>(null);

  // Resetear el override si el item cambia (otra linea seleccionada) o si
  // cambia cualquier campo que altere la sugerencia. Incluye conoCliente
  // (base de la compensación), aReal y calReal — sin estos, un cambio de
  // spec recalculaba la sugerencia pero dejaba el override "pegado" a un
  // cono que ya no corresponde, y handleApply commiteaba ese cono stale.
  useEffect(() => {
    setConoOverride(null);
  }, [
    item.id, item.cono, item.conoCliente,
    item.aCliente, item.calCliente, item.lCliente,
    item.aReal, item.calReal,
  ]);

  // Recalcular sugerencia en tiempo real al mover el slider.
  // Si retorna null, `diagnosis` explica AL VENDEDOR qué falta (vs hasta
  // v1.12 que solo mostraba "ingresa precio del cliente y costo base").
  const { suggestion, diagnosis } = useMemo(() => {
    const costoBaseTotal = item.costoBase + sumAdders(item) + result.cajaBlancoKg;
    const diag = diagnoseSuggestion({
      precio: item.precioCliente,
      tc,
      transpKgMXN: result.transpKgMXN,
      costoBaseTotal,
      aReal: item.aReal,
      calReal: item.calReal,
      lCliente: item.lCliente,
    });
    const s = suggestRealSpec({
      precio: item.precioCliente,
      // TC real del global (editable en TopBar). Antes estaba hardcodeado en
      // 18 con un comentario incorrecto ("ya está embebido en transpKgMXN");
      // el tc convierte el precio USD a MXN para comparar contra costos MXN —
      // es un término distinto al flete. Un tc errado desviaba lReal ~2.7% y
      // la sugerencia divergía del PDF/computeQuote (que usan el tc real).
      tc,
      transpKgMXN: result.transpKgMXN,
      costoBaseTotal,
      aCliente: item.aCliente,
      calCliente: item.calCliente,
      lCliente: item.lCliente,
      aReal: item.aReal,
      calReal: item.calReal,
      // Base de la compensación = cono que el CLIENTE espera (conoCliente),
      // no el cono real actual. Así conoSugerido se calcula contra el peso
      // bruto declarado y PB_real ≤ PB_cliente se mantiene. Fallback a cono
      // para drafts viejos sin conoCliente.
      cono: item.conoCliente ?? item.cono,
      marginTarget,
    });
    return { suggestion: s, diagnosis: diag };
  }, [item, result, marginTarget, tc]);

  // El cono efectivo que se va a aplicar/mostrar es el override del vendedor
  // si existe, si no la sugerencia del algoritmo.
  const conoEfectivo = conoOverride ?? suggestion?.conoSugerido ?? item.cono;

  // Aplicar sugerencia completa: largo real + cono efectivo (sugerido o override)
  const handleApply = () => {
    if (suggestion) {
      onChange({
        lReal: suggestion.lReal,
        cono: conoEfectivo,
      });
      setConoOverride(null);
    }
  };

  // Vendedor escoge un cono alternativo de los estándar mostrados.
  // Guardamos la elección como PREVIEW local — NO toca item.cono ni lReal.
  // El commit ocurre en handleApply cuando el vendedor confirma. Esto evita:
  //  - El bug del lReal acumulando (cambiar lReal -> kgTrailer -> flete/kg ->
  //    siguiente sugerencia con lReal aun mayor, hasta 1.8e8 pies)
  //  - El bug del cono "sumando" (cambiar cono -> conoIdeal sube un escalon ->
  //    sugerido sube un escalon, repite con cada click)
  const handlePickAlternativeCono = (cono: number) => {
    setConoOverride(cono);
  };

  const pricePerLbColor =
    suggestion && (suggestion.pricePerLb < 0.85 || suggestion.pricePerLb > 1.6)
      ? '#F59E0B'
      : '#5BAA47';

  // En modo directa no se optimiza: avisamos y no mostramos la sugerencia.
  if (tipoCotizacion === 'directa') {
    return (
      <div className="card p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-bnp-cyan/15 flex items-center justify-center text-bnp-cyan flex-shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Cotización directa</h3>
            <p className="text-2xs text-text-secondary">
              En este modo se cotiza y fabrica <strong>exactamente</strong> lo que pide el cliente,
              sin optimización. Para ver alternativas que mejoren el margen, cambia el tipo de
              cotización a <strong>Optimizada</strong> arriba.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comparación económica: solicitado vs propuesta interna (Fase 1) */}
      {directResult && (
        <ComparisonCard
          item={item}
          directResult={directResult}
          optimizedResult={result}
          reduction={suggestion?.reduction ?? 0}
        />
      )}

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
        diagnosis={diagnosis}
        conoEfectivo={conoEfectivo}
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
