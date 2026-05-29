'use client';

// TrailerBlock — un bloque visual estilo Scratch que agrupa lineas del mismo
// camión. Header editable (destino + flete USD), body con droparea para las
// lineas asignadas, footer con stats (kg neto, capacidad %, items).

import { useDroppable } from '@dnd-kit/core';
import type { LineItem, CalcResult, Trailer } from '@/types';
import type { TrailerSummary } from '@/lib/pricingEngine';
import { Truck, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { fmtNum, fmtUSD } from '@/lib/format';
import DraggableLineItem from './DraggableLineItem';

interface Props {
  trailer: Trailer;
  trailerIndex: number;
  summary: TrailerSummary | undefined;
  activeItemId: number | null;
  itemsWithResults: { item: LineItem; result: CalcResult | undefined }[];
  canRemove: boolean;
  simpleMode?: boolean;   // México: oculta flete por bloque, capacidad y remove
  onUpdate: (patch: Partial<Trailer>) => void;
  onRemove: () => void;
  onAddItem: () => void;
  onSelectItem: (id: number) => void;
  onDeleteItem: (id: number) => void;
  onDuplicateItem: (id: number) => void;
}

export default function TrailerBlock(p: Props) {
  const { trailer, summary, itemsWithResults } = p;
  const { setNodeRef, isOver } = useDroppable({ id: `trailer-${trailer.id}` });

  const capacityPct = summary?.capacityPct ?? 0;
  const exceedsCapacity = summary?.exceedsCapacity ?? false;
  const capacityColor = exceedsCapacity
    ? '#EF4444'
    : capacityPct > 0.85
    ? '#F59E0B'
    : '#5BAA47';
  const capacityBarWidth = Math.min(100, capacityPct * 100);

  return (
    <div
      ref={setNodeRef}
      className={`card overflow-hidden transition-all ${
        isOver ? 'ring-2 ring-bnp-green shadow-lg scale-[1.01]' : ''
      } ${exceedsCapacity ? 'border-bnp-red/40' : ''}`}
    >
      {/* Header: numero + destino + remove */}
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-surface border-b border-border-subtle">
        {!p.simpleMode && (
          <div className="inline-flex items-center justify-center w-6 h-6 rounded bg-bnp-purple/15 text-bnp-purple text-2xs font-bold">
            {p.trailerIndex}
          </div>
        )}
        <Truck className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
        {p.simpleMode ? (
          <span className="flex-1 text-xs font-semibold text-text-primary">
            Líneas de la cotización
          </span>
        ) : (
          <input
            type="text"
            value={trailer.destino}
            onChange={(e) => p.onUpdate({ destino: e.target.value })}
            placeholder={`Trailer ${p.trailerIndex} (destino)`}
            className="flex-1 bg-transparent text-xs font-semibold text-text-primary outline-none min-w-0"
          />
        )}
        {p.canRemove && (
          <button
            onClick={p.onRemove}
            className="p-1 rounded hover:bg-bnp-red/20 transition-colors"
            title="Eliminar trailer (las líneas se moverán al primero)"
          >
            <Trash2 className="w-3 h-3 text-bnp-red" />
          </button>
        )}
      </div>

      {/* Flete y capacidad — oculto en modo simple (México) */}
      {!p.simpleMode && (
      <div className="px-3 py-2 border-b border-border-subtle text-2xs">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="text-text-muted uppercase tracking-wider font-semibold">
            Flete USD
          </label>
          <input
            type="number" step="100" min="0"
            value={trailer.transport_usd || ''}
            onChange={(e) => p.onUpdate({ transport_usd: parseFloat(e.target.value) || 0 })}
            className="w-24 bg-bg-surface border border-border-subtle rounded px-2 py-0.5 text-right mono text-2xs"
            placeholder="0"
          />
        </div>

        {/* Capacidad bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-text-muted uppercase tracking-wider font-semibold">
              Capacidad
            </span>
            <span className="mono" style={{ color: capacityColor }}>
              {fmtNum(summary?.kgNetoTotal ?? 0, 0)} / {fmtNum(trailer.kg_max, 0)} kg
              {' '}({(capacityPct * 100).toFixed(0)}%)
            </span>
          </div>
          <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{ width: `${capacityBarWidth}%`, backgroundColor: capacityColor }}
            />
          </div>
          {exceedsCapacity && (
            <p className="inline-flex items-center gap-1 text-bnp-red font-semibold pt-1">
              <AlertTriangle className="w-3 h-3" />
              Excede capacidad — separa en otro trailer
            </p>
          )}
        </div>
      </div>
      )}

      {/* Lista de líneas asignadas a este trailer */}
      <div className={`p-2 min-h-[60px] space-y-1.5 ${isOver ? 'bg-bnp-green/5' : ''}`}>
        {itemsWithResults.length === 0 ? (
          <p className="text-2xs text-text-muted text-center py-4 italic">
            Arrastra líneas aquí o haz click en "+ Nueva línea"
          </p>
        ) : (
          itemsWithResults.map(({ item, result }) => (
            <DraggableLineItem
              key={item.id}
              item={item}
              result={result}
              isActive={item.id === p.activeItemId}
              canDelete={true /* siempre puede borrar; el state evita 0 items global */}
              onSelect={() => p.onSelectItem(item.id)}
              onDelete={() => p.onDeleteItem(item.id)}
              onDuplicate={() => p.onDuplicateItem(item.id)}
            />
          ))
        )}
      </div>

      {/* Footer: + nueva línea */}
      <div className="px-2 pb-2">
        <button
          onClick={p.onAddItem}
          className="btn-secondary w-full text-2xs"
        >
          <Plus className="w-3 h-3" />
          Nueva línea en este trailer
        </button>
      </div>
    </div>
  );
}
