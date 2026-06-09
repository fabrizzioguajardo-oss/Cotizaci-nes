'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Upload,
  Database,
  Palette,
  Package2,
  AlertCircle,
  Search,
  RefreshCw,
} from 'lucide-react';
import { usePriceData, invalidatePriceData } from '@/lib/dataStore';
import { fmtNum } from '@/lib/format';
import type { ParsedPriceRow, ParsedTarimaRow, ResinClass } from '@/lib/parsers/types';

// Vista de precios cargados desde /api/data/current (los Excels que Diego subio
// al admin). Reemplaza la vista legacy que leia de la tabla `precios_base`.
//
// Muestra los 3 archivos por separado: EDSA (virgen/reciclado), Color, Tarima.
// Para que Fabrizzio y Diego puedan VER exactamente que precios estan vigentes
// en el cotizador en este momento. Sin esto, una carga rota pasa desapercibida
// hasta que un vendedor cotiza con precios viejos.

type Kind = 'edsa' | 'color' | 'tarima';

export default function BasePricesView() {
  const { data, loading, error } = usePriceData();
  const [kind, setKind] = useState<Kind>('edsa');
  const [resinFilter, setResinFilter] = useState<ResinClass | 'all'>('all');
  const [search, setSearch] = useState('');

  const handleRefresh = () => {
    invalidatePriceData();
    window.location.reload();
  };

  // EDSA rows (virgen + reciclado, sin color)
  const edsaRows: ParsedPriceRow[] = data?.precios_edsa ?? [];
  // Color rows (con tipo_color)
  const colorRows: ParsedPriceRow[] = data?.precios_color ?? [];
  // Tarima rows (catalogo de SKUs)
  const tarimaRows: ParsedTarimaRow[] = data?.catalogo_tarima ?? [];

  const filteredEDSA = useMemo(() => {
    return edsaRows.filter((r) => {
      if (resinFilter !== 'all' && r.resin_class !== resinFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.raw_description.toLowerCase().includes(s) ||
          r.product_type.toLowerCase().includes(s) ||
          String(r.ancho).includes(s)
        );
      }
      return true;
    });
  }, [edsaRows, resinFilter, search]);

  const filteredColor = useMemo(() => {
    return colorRows.filter((r) => {
      if (search) {
        const s = search.toLowerCase();
        return (
          r.raw_description.toLowerCase().includes(s) ||
          (r.color ?? '').toLowerCase().includes(s) ||
          String(r.ancho).includes(s)
        );
      }
      return true;
    });
  }, [colorRows, search]);

  const filteredTarima = useMemo(() => {
    return tarimaRows.filter((r) => {
      if (search) {
        const s = search.toLowerCase();
        return (
          (r.codigo_edsa ?? '').toLowerCase().includes(s) ||
          (r.codigo_alterno ?? '').toLowerCase().includes(s) ||
          String(r.ancho).includes(s)
        );
      }
      return true;
    });
  }, [tarimaRows, search]);

  return (
    <section className="card">
      <div className="card-header">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-bnp-green" />
          <div>
            <h3 className="text-sm font-semibold">Precios vigentes en el cotizador</h3>
            <p className="text-2xs text-text-muted mt-0.5">
              Datos reales que esta usando el cotizador en este momento.
              Cargados via{' '}
              <Link href="/cotizador/precios" className="text-bnp-cyan hover:underline">
                Carga Excel
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="btn-secondary text-xs"
            title="Recargar datos desde Supabase"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recargar
          </button>
          <Link href="/cotizador/precios" className="btn-primary text-xs">
            <Upload className="w-3.5 h-3.5" />
            Cargar Excels
          </Link>
        </div>
      </div>

      {/* Banner de origen de datos */}
      {data?.source === 'static' && (
        <div className="px-4 py-3 border-b border-bnp-amber/40 bg-bnp-amber/5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-bnp-amber flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-bnp-amber">
                Usando fallback estatico (build-time)
              </p>
              <p className="text-2xs text-text-secondary mt-0.5">
                Diego no ha subido Excels nuevos a Supabase. El cotizador esta
                usando el snapshot del build. Sube los archivos actualizados
                desde <span className="mono">Carga Excel</span>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Strip de estado global */}
      <div className="px-4 py-3 bg-bg-surface border-b border-border-subtle">
        {loading ? (
          <p className="text-2xs text-text-muted">Cargando precios...</p>
        ) : error || !data ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-bnp-red flex-shrink-0 mt-0.5" />
            <p className="text-2xs text-bnp-red">
              No se cargaron precios. {error ?? 'Sube los Excels desde Carga Excel.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              label="EDSA"
              value={edsaRows.length}
              filename={data.source_files.edsa}
              icon={<Database className="w-3.5 h-3.5 text-bnp-green" />}
            />
            <Stat
              label="Color"
              value={colorRows.length}
              filename={data.source_files.color}
              icon={<Palette className="w-3.5 h-3.5 text-bnp-purple" />}
            />
            <Stat
              label="Tarima"
              value={tarimaRows.length}
              filename={data.source_files.tarima}
              icon={<Package2 className="w-3.5 h-3.5 text-bnp-cyan" />}
            />
            <div>
              <p className="text-2xs text-text-muted uppercase tracking-wider font-semibold">
                Generado
              </p>
              <p className="mono text-xs mt-0.5">
                {data.generated_at
                  ? new Date(data.generated_at).toLocaleString('es-MX')
                  : '—'}
              </p>
              <p className="text-2xs text-text-muted mt-0.5">
                Fuente: <span className="mono">{data.source ?? '—'}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sub-tabs: EDSA / Color / Tarima */}
      <div className="px-4 border-b border-border-subtle">
        <div className="flex gap-1">
          {(['edsa', 'color', 'tarima'] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setResinFilter('all');
                setSearch('');
              }}
              className={`text-2xs px-3 py-2 border-b-2 transition-colors uppercase tracking-wider font-semibold ${
                kind === k
                  ? 'border-bnp-green text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              {k === 'edsa' && (
                <span className="inline-flex items-center gap-1.5">
                  <Database className="w-3 h-3" /> EDSA ({edsaRows.length})
                </span>
              )}
              {k === 'color' && (
                <span className="inline-flex items-center gap-1.5">
                  <Palette className="w-3 h-3" /> Color ({colorRows.length})
                </span>
              )}
              {k === 'tarima' && (
                <span className="inline-flex items-center gap-1.5">
                  <Package2 className="w-3 h-3" /> Tarima ({tarimaRows.length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros + busqueda */}
      <div className="px-4 py-2 border-b border-border-subtle flex flex-wrap items-center gap-2">
        {kind === 'edsa' && (
          <div className="flex items-center gap-1">
            {(['all', 'virgen', 'reciclado'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setResinFilter(f)}
                className={`text-2xs px-2.5 py-1 rounded-md transition-colors ${
                  resinFilter === f
                    ? 'bg-bnp-green/20 text-bnp-green border border-bnp-green/40'
                    : 'bg-bg-surface text-text-secondary border border-transparent hover:border-border'
                }`}
              >
                {f === 'all' ? 'Todas resinas' : f}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              kind === 'tarima'
                ? 'Buscar por codigo o ancho...'
                : 'Buscar por descripcion, ancho, color...'
            }
            className="bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-muted flex-1"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto max-h-[60vh]">
        {loading ? (
          <p className="p-6 text-center text-sm text-text-muted">Cargando precios...</p>
        ) : !data ? (
          <div className="p-8 text-center">
            <FileSpreadsheet className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-muted">
              No hay precios cargados. Sube los Excels de Diego.
            </p>
          </div>
        ) : kind === 'edsa' ? (
          <EDSATable rows={filteredEDSA} totalCount={edsaRows.length} />
        ) : kind === 'color' ? (
          <ColorTable rows={filteredColor} totalCount={colorRows.length} />
        ) : (
          <TarimaTable rows={filteredTarima} totalCount={tarimaRows.length} />
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  filename,
  icon,
}: {
  label: string;
  value: number;
  filename: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-2xs text-text-muted uppercase tracking-wider font-semibold inline-flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="mono text-base font-semibold mt-0.5">
        {value > 0 ? value : '—'}{' '}
        <span className="text-2xs text-text-muted">filas</span>
      </p>
      {filename && (
        <p className="text-2xs text-text-muted truncate mt-0.5" title={filename}>
          {filename}
        </p>
      )}
    </div>
  );
}

function EDSATable({ rows, totalCount }: { rows: ParsedPriceRow[]; totalCount: number }) {
  if (rows.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-text-muted">
        {totalCount === 0
          ? 'No hay precios EDSA cargados.'
          : 'Sin resultados con este filtro.'}
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-bg-elevated border-b border-border-subtle text-2xs text-text-secondary uppercase tracking-wider">
        <tr>
          <th className="px-3 py-2 text-left">Tipo</th>
          <th className="px-3 py-2 text-left">Resina</th>
          <th className="px-3 py-2 text-right">Ancho</th>
          <th className="px-3 py-2 text-left">Calibres</th>
          <th className="px-3 py-2 text-right">Cono</th>
          <th className="px-3 py-2 text-right">PN</th>
          <th className="px-3 py-2 text-right">PB</th>
          <th className="px-3 py-2 text-right">MXN/kg</th>
          <th className="px-3 py-2 text-left">Sheet</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.source_sheet}-${i}`} className="border-b border-border-subtle hover:bg-bg-hover">
            <td className="px-3 py-1.5 text-2xs">{r.product_type}</td>
            <td className="px-3 py-1.5 text-2xs">{r.resin_class}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.ancho, 2)}″</td>
            <td className="px-3 py-1.5 text-2xs mono">{r.calibres.join(', ')}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.cono, 3)}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.peso_neto, 3)}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.peso_total, 3)}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs font-semibold text-bnp-green">
              {fmtNum(r.precio_mxn_kg, 3)}
            </td>
            <td className="px-3 py-1.5 text-2xs text-text-muted truncate max-w-[120px]" title={r.source_sheet}>
              {r.source_sheet}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ColorTable({ rows, totalCount }: { rows: ParsedPriceRow[]; totalCount: number }) {
  if (rows.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-text-muted">
        {totalCount === 0
          ? 'No hay precios de color cargados.'
          : 'Sin resultados con este filtro.'}
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-bg-elevated border-b border-border-subtle text-2xs text-text-secondary uppercase tracking-wider">
        <tr>
          <th className="px-3 py-2 text-left">Color</th>
          <th className="px-3 py-2 text-left">Tipo</th>
          <th className="px-3 py-2 text-right">Ancho</th>
          <th className="px-3 py-2 text-left">Calibres</th>
          <th className="px-3 py-2 text-right">Cono</th>
          <th className="px-3 py-2 text-right">PN</th>
          <th className="px-3 py-2 text-right">PB</th>
          <th className="px-3 py-2 text-right">Base MXN/kg</th>
          <th className="px-3 py-2 text-right">Master</th>
          <th className="px-3 py-2 text-right">Intenso</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.source_sheet}-${i}`} className="border-b border-border-subtle hover:bg-bg-hover">
            <td className="px-3 py-1.5 text-2xs font-semibold">
              <span className="inline-flex items-center gap-1.5">
                {r.color && (
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: colorDot(r.color) }}
                  />
                )}
                {r.color ?? '—'}
              </span>
            </td>
            <td className="px-3 py-1.5 text-2xs">{r.product_type}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.ancho, 2)}″</td>
            <td className="px-3 py-1.5 text-2xs mono">{r.calibres.join(', ')}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.cono, 3)}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.peso_neto, 3)}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.peso_total, 3)}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs font-semibold text-bnp-green">
              {fmtNum(r.precio_mxn_kg, 3)}
            </td>
            <td className="px-3 py-1.5 text-right mono text-2xs text-bnp-purple">
              {r.master_mxn_kg !== undefined ? fmtNum(r.master_mxn_kg, 2) : '—'}
            </td>
            <td className="px-3 py-1.5 text-right mono text-2xs text-bnp-cyan">
              {r.intenso_mxn_kg !== undefined ? fmtNum(r.intenso_mxn_kg, 2) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TarimaTable({ rows, totalCount }: { rows: ParsedTarimaRow[]; totalCount: number }) {
  if (rows.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-text-muted">
        {totalCount === 0
          ? 'No hay catalogo de tarima cargado.'
          : 'Sin resultados con este filtro.'}
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-bg-elevated border-b border-border-subtle text-2xs text-text-secondary uppercase tracking-wider">
        <tr>
          <th className="px-3 py-2 text-left">Codigo EDSA</th>
          <th className="px-3 py-2 text-left">Alterno</th>
          <th className="px-3 py-2 text-right">Ancho</th>
          <th className="px-3 py-2 text-right">Calibre</th>
          <th className="px-3 py-2 text-right">Cono</th>
          <th className="px-3 py-2 text-right">PN</th>
          <th className="px-3 py-2 text-right">PB</th>
          <th className="px-3 py-2 text-right">Largo real</th>
          <th className="px-3 py-2 text-right">Largo ~</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.codigo_edsa ?? i}-${i}`} className="border-b border-border-subtle hover:bg-bg-hover">
            <td className="px-3 py-1.5 text-2xs mono">{r.codigo_edsa ?? '—'}</td>
            <td className="px-3 py-1.5 text-2xs mono text-text-muted">{r.codigo_alterno ?? '—'}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.ancho, 2)}″</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{r.calibre}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.peso_cono, 3)}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.peso_neto, 3)}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">{fmtNum(r.peso_total, 3)}</td>
            <td className="px-3 py-1.5 text-right mono text-2xs">
              {r.largo_real !== null ? `${fmtNum(r.largo_real, 0)}′` : '—'}
            </td>
            <td className="px-3 py-1.5 text-right mono text-2xs text-text-muted">
              {r.largo_aprox !== null ? `~${fmtNum(r.largo_aprox, 0)}′` : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Maps color name -> hex for a small visual dot. Best-effort, falls back gray.
function colorDot(color: string): string {
  const c = color.toLowerCase();
  if (c.includes('orange') || c.includes('naranja')) return '#F59E0B';
  if (c.includes('purple') || c.includes('morado') || c.includes('violet')) return '#8945B2';
  if (c.includes('white') || c.includes('blanco')) return '#FFFFFF';
  if (c.includes('blue') || c.includes('azul')) return '#3B82F6';
  if (c.includes('red') || c.includes('rojo')) return '#EF4444';
  if (c.includes('green') || c.includes('verde')) return '#5BAA47';
  if (c.includes('yellow') || c.includes('amarillo')) return '#FACC15';
  if (c.includes('black') || c.includes('negro')) return '#1F2937';
  if (c.includes('pink') || c.includes('rosa')) return '#EC4899';
  if (c.includes('brown') || c.includes('cafe') || c.includes('marron')) return '#92400E';
  return '#6B7280';
}
