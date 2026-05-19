'use client';

// Card de una linea individual dentro de un TrailerBlock.
// Es draggable: el vendedor la puede mover a otro trailer arrastrandola.

import { useDraggable } from '@dnd-kit/core';
import type { LineItem, CalcResult } from '@/types';
import { marginStatus } from '@/lib/pricingEngine';
import { fmtUSD, fmtPct } from '@/lib/format';
import { Trash2, Copy, GripVertical } from 'lucide-react';

interface Props {
  item: LineItem;
  result: CalcResult | undefined;
  isActive: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function DraggableLineItem(p: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: p.item.id,
  });

  const status = marginStatus(p.result?.utilidad ?? null);
  const opacity = isDragging ? 0.3 : 1;

  return (
    <div
      ref={setNodeRef}
      style={{ opacity }}
      className={`group rounded-md border transition-colors ${
        p.isActive
          ? 'bg-bg-hover border-bnp-green/60'
          : 'bg-bg-surface border-border-subtle hover:border-border'
      }`}
    >
      <div className="flex items-stretch">
        {/* Drag handle */}
        <button
          {...listeners}
          {...attributes}
          className="px-1 py-2 text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing"
          title="Arrastra para mover a otro trailer"
        >
          <GripVertical className="w-3 h-3" />
        </button>

        {/* Click area para activar la linea */}
        <button
          onClick={p.onSelect}
          className="flex-1 text-left p-2 min-w-0"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <p className="text-2xs font-medium text-text-primary truncate">
                {p.item.desc || `Línea ${p.item.id}`}
              </p>
              <p className="text-2xs text-text-muted mono mt-0.5 truncate">
                {p.item.aCliente}″ × {p.item.calCliente}GA × {p.item.lCliente}′
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-2xs">
            <span className="mono text-text-secondary">
              {p.item.qty} {p.item.unit.toLowerCase()}
            </span>
            <span className="mono text-text-secondary">
              {fmtUSD(p.item.precioCliente)}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }} />
            <span className="text-2xs mono" style={{ color: status.color }}>
              {fmtPct(p.result?.utilidad ?? null)}
            </span>
          </div>
        </button>

        {/* Acciones - hidden hasta hover */}
        <div className="flex flex-col gap-0.5 px-1 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              p.onDuplicate();
            }}
            className="p-0.5 rounded hover:bg-bg-elevated"
            title="Duplicar"
          >
            <Copy className="w-3 h-3 text-text-muted" />
          </button>
          {p.canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                p.onDelete();
              }}
              className="p-0.5 rounded hover:bg-bnp-red/20"
              title="Eliminar"
            >
              <Trash2 className="w-3 h-3 text-bnp-red" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
