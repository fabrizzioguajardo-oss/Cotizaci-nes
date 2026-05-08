'use client';

import type { LineItem, CalcResult } from '@/types';
import { marginStatus } from '@/lib/pricingEngine';
import { fmtUSD, fmtPct } from '@/lib/format';
import { Plus, Trash2, Copy } from 'lucide-react';

interface Props {
  items: LineItem[];
  results: CalcResult[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
}

export default function ItemList({
  items,
  results,
  activeId,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
}: Props) {
  return (
    <div className="card flex flex-col h-full">
      <div className="card-header">
        <h3 className="text-sm font-semibold">Líneas del pedido</h3>
        <span className="text-2xs text-text-muted mono">{items.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {items.map((item, idx) => {
          const r = results[idx];
          const status = marginStatus(r?.utilidad ?? null);
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full text-left p-3 rounded-md border transition-all group ${
                isActive
                  ? 'bg-bg-hover border-bnp-green/60 shadow-glow-green'
                  : 'bg-bg-surface border-border-subtle hover:border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {item.desc || `Línea ${idx + 1}`}
                  </p>
                  <p className="text-2xs text-text-muted mono mt-0.5">
                    {item.aCliente}″ × {item.calCliente}GA × {item.lCliente}′
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(item.id);
                    }}
                    className="p-1 rounded hover:bg-bg-elevated"
                  >
                    <Copy className="w-3 h-3 text-text-muted" />
                  </span>
                  {items.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="p-1 rounded hover:bg-bnp-red/20"
                    >
                      <Trash2 className="w-3 h-3 text-bnp-red" />
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-2xs">
                <span className="mono text-text-secondary">
                  {item.qty} {item.unit.toLowerCase()}
                </span>
                <span className="mono text-text-secondary">
                  {fmtUSD(item.precioCliente)}
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                <span className="text-2xs mono" style={{ color: status.color }}>
                  {fmtPct(r?.utilidad ?? null)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-2 border-t border-border-subtle">
        <button onClick={onAdd} className="btn-secondary w-full text-xs">
          <Plus className="w-3.5 h-3.5" />
          Nueva línea
        </button>
      </div>
    </div>
  );
}
