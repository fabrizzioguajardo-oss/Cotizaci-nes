'use client';

import { useMemo } from 'react';
import type { ConoOption } from '@/lib/lookupEngine';
import type { ResinType, ColorType } from '@/types';
import { lookupConoOptions, deriveResinClass } from '@/lib/lookupEngine';
import { usePriceData } from '@/lib/dataStore';
import { fmtNum, fmtUSD } from '@/lib/format';
import { Star, Database, Sparkles, AlertCircle } from 'lucide-react';

interface Props {
  ancho: number;
  calibre: number;
  largo: number;
  selectedCono: number | null;
  resinType?: ResinType;        // NUEVO: para preview correcto (color vs virgen)
  tipoColor?: ColorType;        // NUEVO: filter por color si aplica
  onPick: (option: ConoOption) => void;
}

// Panel que muestra las opciones de cono que el sistema sugiere para un
// (ancho, calibre, largo) dado. Se actualiza en vivo al cambiar el spec.
// Cada opción muestra: cono, PB, rollos/tarima, precio estimado, ⭐ si histórico.
export default function ConeSelectorPanel({
  ancho,
  calibre,
  largo,
  selectedCono,
  resinType = 'virgen',
  tipoColor,
  onPick,
}: Props) {
  const { data, loading, error } = usePriceData();

  const options = useMemo<ConoOption[]>(() => {
    if (!data || ancho <= 0 || calibre <= 0 || largo <= 0) return [];
    return lookupConoOptions({
      ancho,
      calibre,
      largo_ft: largo,
      catalogo: data.catalogo_tarima,
      rangos: data.rangos_tarima,
      preciosEDSA: data.precios_edsa,
      preciosColor: data.precios_color,
      productosEDSA: data.productos_edsa,
      resin_class: deriveResinClass(resinType, tipoColor),
      color: tipoColor,
    });
  }, [data, ancho, calibre, largo, resinType, tipoColor]);

  if (loading) {
    // Skeleton con la MISMA geometría del grid real de opciones de cono:
    // al llegar los datos no hay salto de layout, solo se "rellena".
    return (
      <div className="card p-3">
        <div className="skeleton h-3 w-40 mb-3" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border border-border-subtle rounded-md p-2.5 space-y-2">
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-3/4" />
              <div className="skeleton h-3.5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-4 border-bnp-amber/40">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-bnp-amber flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-bnp-amber mb-1">
              Datos de precios no disponibles
            </p>
            <p className="text-2xs text-text-secondary">
              Sube los Excels en <span className="mono">/admin</span> o ejecuta{' '}
              <span className="mono">npx tsx scripts/build-static-data.ts</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (ancho <= 0 || calibre <= 0 || largo <= 0) {
    // Empty state con personalidad: dice QUÉ va a aparecer aquí y qué falta.
    return (
      <div className="card p-6 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-bg-surface border border-border-subtle mb-3">
          <Sparkles className="w-5 h-5 text-text-muted" />
        </div>
        <p className="text-sm font-medium text-text-secondary">
          Las opciones de cono aparecen aquí
        </p>
        <p className="text-2xs text-text-muted mt-1">
          Llena <span className="text-bnp-cyan">ancho, calibre y largo</span> arriba para ver conos,
          rollos por tarima y precio estimado.
        </p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="card p-4 border-bnp-amber/40">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-bnp-amber flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-bnp-amber">
              No hay opciones para {ancho}″ × {calibre}GA × {largo}′
            </p>
            <p className="text-2xs text-text-secondary mt-1">
              Producto fuera del catálogo histórico. Llena manualmente cono y costos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-bnp-green" />
          <h4 className="text-xs font-semibold uppercase tracking-wider">
            Opciones de fabricación
          </h4>
        </div>
        <span className="text-2xs text-text-muted">{options.length} opciones</span>
      </div>

      {/* Warning visible cuando los datos vienen del fallback estatico (build-time).
          Significa que Diego no ha subido excels recientes y los precios pueden
          estar desactualizados. El cone selector sigue funcionando con esos
          precios pero el admin debe subir excels nuevos para tener confianza. */}
      {data.source === 'static' && (
        <div className="px-4 py-2 border-b border-bnp-amber/30 bg-bnp-amber/5">
          <p className="text-2xs text-bnp-amber inline-flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" />
            <span>
              <strong>Precios viejos del build (referencia).</strong>{' '}
              Pídele a Diego que suba los Excels nuevos en{' '}
              <span className="mono">Admin → Carga Excel EDSA</span>{' '}
              para que estos números sean exactos.
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
        {options.map((opt) => {
          const isSelected = Math.abs(opt.cono - (selectedCono ?? -99)) < 0.01;
          return (
            <button
              key={opt.cono}
              type="button"
              onClick={() => onPick(opt)}
              className={`text-left p-3 rounded-md border transition-all ${
                isSelected
                  ? 'bg-bnp-green/10 border-bnp-green shadow-glow-green'
                  : 'bg-bg-surface border-border-subtle hover:border-border'
              }`}
            >
              {/* Header con cono y badge histórico */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-2xs text-text-muted uppercase tracking-wider font-semibold">
                    Cono
                  </p>
                  <p className="mono text-lg font-semibold">
                    {opt.cono.toFixed(opt.cono < 1 ? 3 : 2)} <span className="text-2xs text-text-muted">kg</span>
                  </p>
                </div>
                {opt.is_exact_catalog_match && (
                  <span
                    className="inline-flex items-center gap-1 text-2xs font-semibold text-bnp-amber"
                    title="Existe en catálogo histórico de Diego"
                  >
                    <Star className="w-3 h-3 fill-current" />
                    Histórico
                  </span>
                )}
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div>
                  <p className="text-text-muted">PN / PB</p>
                  <p className="mono font-semibold">
                    {fmtNum(opt.pn, 2)} / {fmtNum(opt.pb, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted">Rollos/tarima</p>
                  <p className="mono font-semibold">
                    {opt.rollos_por_tarima || '—'}
                  </p>
                </div>
                {opt.pz_por_cama > 0 && (
                  <div className="col-span-2">
                    <p className="text-text-muted">
                      <span className="mono">{opt.pz_por_cama}/cama × {opt.camas_por_tarima} camas</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Precio estimado */}
              {opt.precio_estimado_mxn_kg !== null && (
                <div className="mt-2 pt-2 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-2xs text-text-muted">Precio EDSA est.</span>
                  <span className="mono text-xs font-semibold text-bnp-green">
                    {fmtNum(opt.precio_estimado_mxn_kg, 2)} MXN/kg
                  </span>
                </div>
              )}

              {/* Largo histórico si match */}
              {opt.catalog_match?.largo_aprox && (
                <p className="text-2xs text-text-muted mono mt-1.5">
                  histórico: ~{opt.catalog_match.largo_aprox}′
                </p>
              )}
            </button>
          );
        })}
      </div>

      {data.generated_at && (
        <div className="px-4 py-2 border-t border-border-subtle flex items-center justify-between text-2xs text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Database className="w-3 h-3" />
            Datos del {new Date(data.generated_at).toLocaleDateString('es-MX')}
          </span>
          <span className="mono">
            {data.stats.edsa_rows + data.stats.color_rows} precios · {data.stats.tarima_skus} SKUs
          </span>
        </div>
      )}
    </div>
  );
}
