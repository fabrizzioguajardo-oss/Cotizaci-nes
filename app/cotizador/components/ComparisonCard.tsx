'use client';

import type { LineItem, CalcResult } from '@/types';
import { fmtNum, fmtUSD, fmtPct } from '@/lib/format';
import { MARGIN_MIN, REDUCTION_WARN_HIGH } from '@/lib/pricingEngine';
import { ArrowRight, TrendingUp, AlertTriangle, CheckCircle, Scale } from 'lucide-react';

interface Props {
  item: LineItem;
  // Resultado "directo": fabricar EXACTAMENTE lo que pide el cliente.
  directResult: CalcResult;
  // Resultado "optimizado": el spec real actual (con reducción/compensación).
  optimizedResult: CalcResult;
  // Reducción de material de la sugerencia (0..1), para evaluar riesgo.
  reduction: number;
}

// Pantalla comparativa económica (Fase 1). Muestra lado a lado lo que el
// cliente pidió vs la propuesta interna optimizada, con el impacto en costo,
// margen y dinero — y una recomendación + nivel de riesgo.
export default function ComparisonCard({ item, directResult, optimizedResult, reduction }: Props) {
  const unidades = item.rollosPallet * item.palletTrailer;

  // Costo por rollo (USD) en cada escenario.
  const costoDirecto = directResult.costoRolloUSD;
  const costoOpt = optimizedResult.costoRolloUSD;
  const ahorroPorRollo = costoDirecto - costoOpt;       // + = la optimización ahorra
  const ahorroTotal = ahorroPorRollo * unidades;

  // Margen (utilidad sobre costo) en cada escenario.
  const margenDirecto = directResult.utilidad;
  const margenOpt = optimizedResult.utilidad;
  const deltaMargen =
    margenDirecto !== null && margenOpt !== null ? margenOpt - margenDirecto : null;

  // Riesgo + recomendación.
  // - Reducción > 35% es la spec crítica que (en modo revisión) requiere
  //   aprobación. La marcamos como riesgo alto.
  const riesgoAlto = reduction > REDUCTION_WARN_HIGH;
  const margenBajoMin = margenOpt !== null && margenOpt < MARGIN_MIN;

  let recomendacion: { texto: string; tono: 'bien' | 'precaucion' | 'alto' };
  if (riesgoAlto) {
    recomendacion = {
      texto: `La reducción de ${fmtPct(reduction)} supera el 35% — requiere aprobación comercial/técnica antes de emitir.`,
      tono: 'alto',
    };
  } else if (ahorroPorRollo <= 0) {
    recomendacion = {
      texto: 'La optimización no mejora el costo. Conviene cotizar directo (fabricar tal cual el cliente).',
      tono: 'precaucion',
    };
  } else if (margenBajoMin) {
    recomendacion = {
      texto: `Optimizar ayuda, pero el margen (${fmtPct(margenOpt)}) sigue bajo el mínimo de ${(MARGIN_MIN * 100).toFixed(0)}%.`,
      tono: 'precaucion',
    };
  } else {
    recomendacion = {
      texto: `Optimizar mejora el margen y ahorra ${fmtUSD(ahorroTotal)} en esta línea. Recomendado.`,
      tono: 'bien',
    };
  }

  const tonoColor =
    recomendacion.tono === 'bien' ? '#5BAA47' : recomendacion.tono === 'alto' ? '#EF4444' : '#F59E0B';
  const TonoIcon =
    recomendacion.tono === 'bien' ? CheckCircle : recomendacion.tono === 'alto' ? AlertTriangle : AlertTriangle;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Scale className="w-4 h-4 text-bnp-cyan" />
        <h3 className="text-sm font-semibold">Comparación: solicitado vs propuesta interna</h3>
      </div>

      {/* Dos columnas: solicitado vs optimizado */}
      <div className="grid grid-cols-2 gap-4">
        {/* SOLICITADO POR EL CLIENTE */}
        <div className="border border-bnp-cyan/30 bg-bnp-cyan/5 rounded-lg p-4">
          <p className="text-2xs font-semibold text-bnp-cyan uppercase tracking-wider mb-2">
            Solicitado por el cliente
          </p>
          <p className="mono text-sm mb-2">
            {item.aCliente}″ × {item.calCliente}GA × {item.lCliente}′
          </p>
          <Row label="Costo / rollo" value={fmtUSD(costoDirecto)} />
          <Row label="Margen" value={fmtPct(margenDirecto)} />
          <Row label="PN" value={`${fmtNum(directResult.pnReal, 3)} kg`} />
        </div>

        {/* PROPUESTA INTERNA OPTIMIZADA */}
        <div className="border border-bnp-green/40 bg-bnp-green/5 rounded-lg p-4">
          <p className="text-2xs font-semibold text-bnp-green uppercase tracking-wider mb-2">
            Propuesta interna (optimizada)
          </p>
          <p className="mono text-sm mb-2">
            {item.aReal}″ × {item.calReal}GA × {item.lReal}′
          </p>
          <Row label="Costo / rollo" value={fmtUSD(costoOpt)} />
          <Row label="Margen" value={fmtPct(margenOpt)} highlight />
          <Row label="PN" value={`${fmtNum(optimizedResult.pnReal, 3)} kg`} />
        </div>
      </div>

      {/* Diferencias */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-bg-surface rounded-md p-3 text-center">
          <p className="text-2xs text-text-muted uppercase tracking-wider">Ahorro / rollo</p>
          <p className="mono text-base font-semibold mt-0.5" style={{ color: ahorroPorRollo > 0 ? '#5BAA47' : '#EF4444' }}>
            {ahorroPorRollo >= 0 ? '+' : ''}{fmtUSD(ahorroPorRollo)}
          </p>
        </div>
        <div className="bg-bg-surface rounded-md p-3 text-center">
          <p className="text-2xs text-text-muted uppercase tracking-wider">Diferencia total</p>
          <p className="mono text-base font-semibold mt-0.5" style={{ color: ahorroTotal > 0 ? '#5BAA47' : '#EF4444' }}>
            {ahorroTotal >= 0 ? '+' : ''}{fmtUSD(ahorroTotal)}
          </p>
          <p className="text-2xs text-text-muted mt-0.5">{fmtNum(unidades, 0)} rollos</p>
        </div>
        <div className="bg-bg-surface rounded-md p-3 text-center">
          <p className="text-2xs text-text-muted uppercase tracking-wider">Δ Margen</p>
          <p className="mono text-base font-semibold mt-0.5 inline-flex items-center gap-1" style={{ color: (deltaMargen ?? 0) > 0 ? '#5BAA47' : '#64748B' }}>
            {deltaMargen !== null && deltaMargen > 0 && <TrendingUp className="w-3 h-3" />}
            {deltaMargen === null ? '—' : `${deltaMargen >= 0 ? '+' : ''}${(deltaMargen * 100).toFixed(1)} pts`}
          </p>
        </div>
      </div>

      {/* Riesgo + recomendación */}
      <div
        className="mt-4 p-3 rounded-md border flex items-start gap-2"
        style={{ borderColor: `${tonoColor}55`, backgroundColor: `${tonoColor}11` }}
      >
        <TonoIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: tonoColor }} />
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider" style={{ color: tonoColor }}>
            {recomendacion.tono === 'alto'
              ? 'Requiere aprobación'
              : recomendacion.tono === 'precaucion'
              ? 'Precaución'
              : 'Recomendación'}
          </p>
          <p className="text-2xs text-text-secondary mt-0.5">{recomendacion.texto}</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-2xs text-text-secondary mt-0.5">
      <span>{label}:</span>
      <span className={`mono ${highlight ? 'text-bnp-green font-semibold' : 'text-text-primary'}`}>{value}</span>
    </div>
  );
}
