'use client';

import type { LineItem, CalcResult, ResinType, ColorType, Unit } from '@/types';
import { fmtNum, fmtUSD } from '@/lib/format';
import CatalogPicker from './CatalogPicker';
import ConeSelectorPanel from './ConeSelectorPanel';
import MatchQualityBadge from './MatchQualityBadge';
import SpecCards from './SpecCards';
import { usePriceData } from '@/lib/dataStore';
import { buildAutoFill, deriveResinClass, type ConoOption } from '@/lib/lookupEngine';
import { useState } from 'react';

interface Props {
  item: LineItem;
  result: CalcResult;
  esMexico?: boolean;   // muestra moneda MXN + campo "precio anterior"
  onChange: (patch: Partial<LineItem>) => void;
}

// Editor completo de una línea del pedido. Tres secciones:
//   1) Spec del cliente (cyan)   - lo que el cliente cree que recibe
//   2) Configuración logística    - cono, rollos/tarima, tarimas/trailer
//   3) Costos MXN/kg              - base + adders
// + campo de precio del cliente al final
export default function LineItemEditor({ item, result, esMexico, onChange }: Props) {
  const { data } = usePriceData();
  // Calidad del último match aplicado (para mostrar badge en la sección de costos)
  const [matchQuality, setMatchQuality] = useState<'exact' | 'close' | 'interpolated' | null>(null);
  const [matchSource, setMatchSource] = useState<string>('');

  const num = (key: keyof LineItem) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ [key]: parseFloat(e.target.value) || 0 } as Partial<LineItem>);

  const str = (key: keyof LineItem) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ [key]: e.target.value } as Partial<LineItem>);

  // Cuando el vendedor modifica ancho o calibre del SPEC CLIENTE, el SPEC REAL
  // debe seguir el mismo valor. Solo el LARGO real puede diferir (eso es lo que
  // ajustamos para subir margen). Esto evita drift donde aReal != aCliente.
  const setAnchoCliente = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value) || 0;
    onChange({ aCliente: v, aReal: v });
  };
  const setCalibreCliente = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value) || 0;
    onChange({ calCliente: v, calReal: v });
  };

  // Cuando el vendedor elige un cono del panel, auto-llenamos:
  // cono, rollos/tarima, costo base, master, intenso (cuando aplica)
  const handleConePick = (option: ConoOption) => {
    if (!data) return;

    // resin_class unificado con el preview (deriveResinClass). Antes esta
    // derivación estaba duplicada e inconsistente con ConeSelectorPanel.
    const resinClass = deriveResinClass(item.tipoResina, item.tipoColor);

    // Preservar el largo real si el vendedor YA lo redujo en Tab 2. Antes
    // re-elegir un cono forzaba lReal = lCliente, revirtiendo en silencio la
    // reducción de material (y el margen ganado) y mandando a planta el largo
    // completo. Solo defaulteamos a lCliente cuando lReal aún no se ha fijado.
    const lRealPreservado = item.lReal > 0 ? item.lReal : item.lCliente;

    const fill = buildAutoFill({
      ancho: item.aCliente,
      calibre: item.calCliente,
      largo_ft: item.lCliente,
      cono: option.cono,
      resin_class: resinClass,
      color: item.tipoColor,  // pasa color para filter por orange/black/etc
      preciosEDSA: data.precios_edsa,
      preciosColor: data.precios_color,
      rangos: data.rangos_tarima,
    });

    if (!fill) {
      // No encontramos precio - solo aplicamos cono y rollos/tarima.
      // Setea conoCliente (lo que el cliente espera) Y cono (real), iguales
      // al inicio. La compensación en Tab 2 después sube solo `cono`.
      onChange({
        conoCliente: option.cono,
        cono: option.cono,
        aReal: item.aCliente,
        calReal: item.calCliente,
        lReal: lRealPreservado,
        rollosPallet: option.rollos_por_tarima || item.rollosPallet,
      });
      setMatchQuality(null);
      return;
    }

    onChange({
      conoCliente: fill.cono,
      cono: fill.cono,
      aReal: item.aCliente,
      calReal: item.calCliente,
      lReal: lRealPreservado,
      rollosPallet: fill.rollos_por_tarima || item.rollosPallet,
      costoBase: fill.costo_base_mxn_kg,
      master: fill.master_mxn_kg || item.master,
      intenso: fill.intenso_mxn_kg || item.intenso,
    });
    setMatchQuality(fill.match_quality);
    setMatchSource(fill.source_note);
  };

  return (
    <div className="space-y-5">
      {/* Descripción y unidad */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-7">
          <label className="label">Descripción del producto</label>
          <input
            type="text"
            value={item.desc}
            onChange={str('desc')}
            placeholder='ej. PALLET WRAP CLEAR 18" × 1500'
            className="input input-text"
          />
        </div>
        <div className="col-span-3">
          <label className="label">Cantidad</label>
          <input
            type="number"
            value={item.qty || ''}
            onChange={num('qty')}
            className="input"
          />
        </div>
        <div className="col-span-2">
          <label className="label">Unidad</label>
          <select
            value={item.unit}
            onChange={str('unit')}
            className="input input-text"
          >
            <option value="Cases">Cases</option>
            <option value="Rolls">Rolls</option>
            <option value="Pallets">Pallets</option>
          </select>
        </div>
      </div>

      {/* === Sección 1: Spec del cliente (CYAN) === */}
      <section className="border border-bnp-cyan/30 bg-bnp-cyan/5 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-bnp-cyan" />
          <h4 className="text-xs font-semibold text-bnp-cyan uppercase tracking-wider">
            Spec declarado al cliente
          </h4>
          <span className="text-2xs text-text-muted">— lo que va en la cotización e invoice</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Ancho (in)</label>
            <input
              type="number" step="0.1"
              value={item.aCliente || ''}
              onChange={setAnchoCliente}
              className="input input-cyan"
            />
          </div>
          <div>
            <label className="label">Calibre (GA)</label>
            <input
              type="number" step="1"
              value={item.calCliente || ''}
              onChange={setCalibreCliente}
              className="input input-cyan"
            />
          </div>
          <div>
            <label className="label">Largo (ft)</label>
            <input
              type="number" step="10"
              value={item.lCliente || ''}
              onChange={num('lCliente')}
              className="input input-cyan"
            />
          </div>
        </div>
        <p className="text-2xs text-text-muted mt-2 mono">
          PN teórico cliente: {fmtNum(result.pnTeoricoClienteKg, 3)} kg ({fmtNum(result.pnTeoricoClienteLbs, 2)} lb)
        </p>

        {/* Tipo de resina y color */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="label">Tipo de resina</label>
            <select
              value={item.tipoResina}
              onChange={(e) => onChange({ tipoResina: e.target.value as ResinType })}
              className="input input-text"
            >
              <option value="virgen">Virgen</option>
              <option value="reciclado">Reciclado</option>
              <option value="color">Color (sobre virgen)</option>
            </select>
          </div>
          <div>
            <label className="label">Color</label>
            <select
              value={item.tipoColor}
              onChange={(e) => onChange({ tipoColor: e.target.value as ColorType })}
              className="input input-text"
            >
              <option value="clear">Clear</option>
              <option value="orange">Orange</option>
              <option value="black">Black</option>
              <option value="blue">Blue</option>
              <option value="red">Red</option>
              <option value="green">Green</option>
              <option value="yellow">Yellow</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </section>

      {/* === Selector de cono inteligente === */}
      <ConeSelectorPanel
        ancho={item.aCliente}
        calibre={item.calCliente}
        largo={item.lCliente}
        selectedCono={item.cono}
        resinType={item.tipoResina}
        tipoColor={item.tipoColor}
        onPick={handleConePick}
      />

      {/* === Cards de spec calculado: PN/PB, kg tarima, rollos, kg item === */}
      <SpecCards item={item} result={result} />

      {/* === Sección 2: Configuración logística === */}
      <section className="border border-border bg-bg-surface rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-bnp-purple" />
          <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Configuración logística
          </h4>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Cono (kg)</label>
            <input
              type="number" step="0.01"
              value={item.conoCliente || ''}
              // Edita el cono que el cliente espera. Espeja al cono real
              // (igual que ancho/calibre cliente→real); la compensación de
              // Tab 2 después sube solo el cono real sin tocar conoCliente.
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                onChange({ conoCliente: v, cono: v });
              }}
              className="input input-purple"
            />
          </div>
          <div>
            <label className="label">Rollos / tarima</label>
            <input
              type="number" step="1"
              value={item.rollosPallet || ''}
              onChange={num('rollosPallet')}
              className="input input-purple"
            />
          </div>
          <div>
            <label className="label">Tarimas / trailer</label>
            <input
              type="number" step="1"
              value={item.palletTrailer || ''}
              onChange={num('palletTrailer')}
              className="input input-purple"
            />
          </div>
        </div>
        <p className="text-2xs text-text-muted mt-2 mono">
          Total rollos del item: {fmtNum(item.rollosPallet * item.palletTrailer, 0)} •
          KG neto: {fmtNum(result.kgNetoItem, 1)} kg
        </p>
      </section>

      {/* === Sección 3: Costos MXN/kg (build-up) === */}
      <section className="border border-border bg-bg-surface rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-bnp-amber" />
            <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              Build-up de costo (MXN/kg)
            </h4>
          </div>
          <MatchQualityBadge quality={matchQuality} source={matchSource} />
        </div>
        <p className="text-2xs text-text-muted mb-3">
          Cada adder se puede cargar del catálogo central (botón <span className="text-bnp-green">catálogo</span>).
          Lo que se centraliza una vez se reusa en todas las cotizaciones.
        </p>

        <div className="grid grid-cols-4 gap-3">
          {/* Base EDSA */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
                Base EDSA
              </label>
            </div>
            <input
              type="number" step="0.01"
              value={item.costoBase || ''}
              onChange={num('costoBase')}
              className="input"
            />
          </div>

          {/* Master color */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
                Master color
              </label>
              <CatalogPicker
                category="master"
                onPick={(e) => onChange({ master: e.precio_mxn_kg })}
              />
            </div>
            <input
              type="number" step="0.1"
              value={item.master || ''}
              onChange={num('master')}
              className="input"
            />
          </div>

          {/* Intenso */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
                Intenso
              </label>
              <CatalogPicker
                category="intenso"
                onPick={(e) => onChange({ intenso: e.precio_mxn_kg })}
              />
            </div>
            <input
              type="number" step="0.1"
              value={item.intenso || ''}
              onChange={num('intenso')}
              className="input"
            />
          </div>

          {/* Aditivo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
                Aditivo (UV/VCI)
              </label>
              <CatalogPicker
                category="aditivo"
                onPick={(e) => onChange({ aditivo: e.precio_mxn_kg })}
              />
            </div>
            <input
              type="number" step="0.1"
              value={item.aditivo || ''}
              onChange={num('aditivo')}
              className="input"
            />
          </div>

          {/* Aumento 1 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
                Aumento 1
              </label>
              <CatalogPicker
                category="aumento"
                onPick={(e) => onChange({ aumento1: e.precio_mxn_kg })}
              />
            </div>
            <input
              type="number" step="0.1"
              value={item.aumento1 || ''}
              onChange={num('aumento1')}
              className="input"
            />
          </div>

          {/* Aumento 2 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
                Aumento 2
              </label>
              <CatalogPicker
                category="aumento"
                onPick={(e) => onChange({ aumento2: e.precio_mxn_kg })}
              />
            </div>
            <input
              type="number" step="0.1"
              value={item.aumento2 || ''}
              onChange={num('aumento2')}
              className="input"
            />
          </div>

          {/* Refilado */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
                Refilado
              </label>
              <CatalogPicker
                category="refilado"
                onPick={(e) => onChange({ refilado: e.precio_mxn_kg })}
              />
            </div>
            <input
              type="number" step="0.1"
              value={item.refilado || ''}
              onChange={num('refilado')}
              className="input"
            />
          </div>

          {/* Caja blanca */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
                Caja blanca (MXN)
              </label>
              <CatalogPicker
                category="caja"
                pnRealKg={result.pnReal}
                rollosCaja={item.rollosCaja}
                onPick={(e) => {
                  const rollos = Number(e.inputs?.rollos_caja ?? item.rollosCaja);
                  // Si el catálogo trae caja_mxn directo, úsalo. Si no, derívalo
                  // de precio/kg × PN × rollos/caja — PERO solo si hay un PN real.
                  // Antes el fallback usaba `result.pnReal || 1`, fabricando un
                  // costo basado en 1 kg ficticio cuando aún no había spec real,
                  // metiendo un cargo inventado. Ahora, sin PN, dejamos 0 (sin
                  // caja) hasta que el spec exista.
                  const directo = Number(e.inputs?.caja_mxn ?? 0);
                  const derivado =
                    result.pnReal > 0
                      ? e.precio_mxn_kg * result.pnReal * (item.rollosCaja || 4)
                      : 0;
                  onChange({ cajaMXN: directo || derivado, rollosCaja: rollos });
                }}
              />
            </div>
            <input
              type="number" step="1"
              value={item.cajaMXN || ''}
              onChange={num('cajaMXN')}
              className="input"
              placeholder="0 = sin caja"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="label">Rollos / caja</label>
            <input
              type="number" step="1"
              value={item.rollosCaja || ''}
              onChange={num('rollosCaja')}
              className="input"
            />
          </div>
          <div>
            <label className="label">Caja distribuida (MXN/kg)</label>
            <input
              type="text" disabled
              value={fmtNum(result.cajaBlancoKg, 4)}
              className="input opacity-60"
            />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between">
          <span className="text-2xs text-text-secondary uppercase tracking-wider font-semibold">
            Costo total MXN/kg
          </span>
          <span className="mono text-base font-semibold text-bnp-amber">
            {fmtNum(result.costoTotalKgMXN, 3)} + {fmtNum(result.transpKgMXN, 3)} flete
          </span>
        </div>
      </section>

      {/* === Precio del cliente (verde, prominente) === */}
      <section className="border border-bnp-green/40 bg-bnp-green/5 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-bnp-green" />
          <h4 className="text-xs font-semibold text-bnp-green uppercase tracking-wider">
            Precio negociado con el cliente ({esMexico ? 'MXN' : 'USD'} por {item.unit.toLowerCase()})
          </h4>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <input
              type="number" step="0.01"
              value={item.precioCliente || ''}
              onChange={num('precioCliente')}
              placeholder="0.00"
              className="input input-green text-2xl py-3 font-semibold"
              style={{ height: 'auto' }}
            />
            {esMexico && (
              <div className="mt-2">
                <label className="label">Precio anterior por rollo (MXN, opcional)</label>
                <input
                  type="number" step="0.01"
                  value={item.precioAnterior || ''}
                  onChange={num('precioAnterior')}
                  placeholder="—"
                  className="input"
                />
              </div>
            )}
          </div>
          <div className="col-span-2 flex items-center justify-around text-center">
            <div>
              <p className="text-2xs text-text-muted uppercase tracking-wider">Costo USD</p>
              <p className="mono text-base font-semibold">{fmtUSD(result.costoRolloUSD)}</p>
            </div>
            <div>
              <p className="text-2xs text-text-muted uppercase tracking-wider">Margen $</p>
              <p className="mono text-base font-semibold text-bnp-green">
                {fmtUSD(item.precioCliente - result.costoRolloUSD)}
              </p>
            </div>
            <div>
              <p className="text-2xs text-text-muted uppercase tracking-wider">Price/lb</p>
              <p className="mono text-base font-semibold">{fmtUSD(result.pricePerLb, 3)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
