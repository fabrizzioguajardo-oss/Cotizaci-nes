'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, Upload } from 'lucide-react';
import type { PrecioBase } from '@/types';
import { fmtNum } from '@/lib/format';
import FreshnessBadge from '@/app/cotizador/components/FreshnessBadge';
import { freshnessFromDate, oldestFreshness } from '@/lib/freshness';

// Vista de precios base EDSA actualmente cargados.
// Reemplaza el redirect previo con una tabla real.
export default function BasePricesView() {
  const [precios, setPrecios] = useState<PrecioBase[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'virgen' | 'reciclado' | 'color'>('all');

  useEffect(() => {
    fetch('/api/precios')
      .then((r) => r.json())
      .then((data) => {
        setPrecios(data.precios ?? []);
        setLoading(false);
      })
      .catch(() => {
        setPrecios([]);
        setLoading(false);
      });
  }, []);

  const filtered = precios?.filter((p) => filter === 'all' || p.tipo_resina === filter) ?? [];

  // Frescura agregada de todos los precios cargados
  const aggregateFreshness = oldestFreshness(
    (precios ?? []).map((p) => p.fecha_vigencia),
  );

  return (
    <section className="card">
      <div className="card-header">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-bnp-green" />
          <div>
            <h3 className="text-sm font-semibold">Precios base EDSA / Extruidos</h3>
            <p className="text-2xs text-text-muted mt-0.5">
              Stretch films de virgen, reciclado y color que Diego envía por Excel.
            </p>
          </div>
        </div>
        <Link href="/cotizador/precios" className="btn-primary text-xs">
          <Upload className="w-3.5 h-3.5" />
          Cargar nuevo Excel
        </Link>
      </div>

      {/* Strip de status global */}
      <div className="px-4 py-3 bg-bg-surface border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-2xs text-text-muted uppercase tracking-wider font-semibold">
            Total cargado
          </span>
          <span className="mono text-base font-semibold">
            {precios?.length ?? '—'} <span className="text-2xs text-text-muted">filas</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-text-muted uppercase tracking-wider font-semibold">
            Última carga
          </span>
          <FreshnessBadge info={aggregateFreshness} size="md" />
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-2 border-b border-border-subtle flex items-center gap-2">
        {(['all', 'virgen', 'reciclado', 'color'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-2xs px-2.5 py-1 rounded-md transition-colors ${
              filter === f
                ? 'bg-bnp-green/20 text-bnp-green border border-bnp-green/40'
                : 'bg-bg-surface text-text-secondary border border-transparent hover:border-border'
            }`}
          >
            {f === 'all' ? 'Todos' : f}
            {precios && f !== 'all' && (
              <span className="ml-1 text-text-muted">
                ({precios.filter((p) => p.tipo_resina === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto max-h-96">
        {loading ? (
          <p className="p-6 text-center text-sm text-text-muted">Cargando...</p>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <FileSpreadsheet className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-muted">
              {precios?.length === 0
                ? 'No hay precios cargados — sube el primer Excel de Diego.'
                : 'Sin resultados para este filtro.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bg-elevated border-b border-border-subtle text-2xs text-text-secondary uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Resina</th>
                <th className="px-3 py-2 text-left">Color</th>
                <th className="px-3 py-2 text-right">Ancho</th>
                <th className="px-3 py-2 text-right">Calibre</th>
                <th className="px-3 py-2 text-right">PN</th>
                <th className="px-3 py-2 text-right">Cono</th>
                <th className="px-3 py-2 text-right">MXN/kg</th>
                <th className="px-3 py-2 text-left">Frescura</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border-subtle hover:bg-bg-hover">
                  <td className="px-3 py-2 text-xs">{p.tipo_resina}</td>
                  <td className="px-3 py-2 text-xs">{p.tipo_color ?? '—'}</td>
                  <td className="px-3 py-2 text-right mono text-xs">{p.ancho_in ?? '—'}</td>
                  <td className="px-3 py-2 text-right mono text-xs">{p.calibre_ga ?? '—'}</td>
                  <td className="px-3 py-2 text-right mono text-xs">
                    {p.peso_neto_kg !== null ? fmtNum(p.peso_neto_kg, 3) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right mono text-xs">
                    {p.cono_kg !== null ? fmtNum(p.cono_kg, 3) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right mono text-xs font-semibold text-bnp-green">
                    {fmtNum(p.precio_mxn_kg, 3)}
                  </td>
                  <td className="px-3 py-2">
                    <FreshnessBadge date={p.fecha_vigencia} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
