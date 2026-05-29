'use client';

// TrailerStack — sidebar izquierdo del cotizador.
// Estilo Scratch: cada trailer es un bloque contenedor que puede agrupar
// lineas. Las lineas se pueden arrastrar entre trailers. Cada trailer tiene
// su propio costo de flete y muestra su uso de capacidad (kg / kg_max).

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { LineItem, CalcResult, Trailer } from '@/types';
import type { TrailerSummary } from '@/lib/pricingEngine';
import { Plus, Truck } from 'lucide-react';
import TrailerBlock from './TrailerBlock';
import DraggableLineItem from './DraggableLineItem';

interface Props {
  trailers: Trailer[];
  items: LineItem[];
  results: CalcResult[];
  perTrailer: TrailerSummary[];
  activeId: number | null;
  onSelectItem: (id: number) => void;
  onAddItem: (trailerId?: number) => void;
  onDeleteItem: (id: number) => void;
  onDuplicateItem: (id: number) => void;
  onAddTrailer: () => void;
  onRemoveTrailer: (id: number) => void;
  onUpdateTrailer: (id: number, patch: Partial<Trailer>) => void;
  onMoveItem: (itemId: number, trailerId: number) => void;
  // Modo simple (México/Extruidos): un solo trailer sin flete por bloque,
  // sin barra de capacidad ni botón "Agregar trailer". El transporte se
  // maneja en un panel aparte (pickup / Castores).
  simpleMode?: boolean;
}

export default function TrailerStack(props: Props) {
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // pequeño threshold para evitar drags accidentales
    }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingItemId(Number(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingItemId(null);
    if (!e.over) return;
    const itemId = Number(e.active.id);
    // El droppable ID es "trailer-{id}"
    const overId = String(e.over.id);
    const match = overId.match(/^trailer-(\d+)$/);
    if (!match) return;
    const trailerId = Number(match[1]);
    props.onMoveItem(itemId, trailerId);
  };

  const draggingItem = props.items.find((it) => it.id === draggingItemId);

  return (
    <div className="flex flex-col gap-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {props.trailers.map((trailer, idx) => {
          const trailerItems = props.items.filter((it) => it.trailerId === trailer.id);
          // Resultados ordenados igual que items
          const itemsWithResults = trailerItems.map((it) => ({
            item: it,
            result: props.results[props.items.indexOf(it)],
          }));
          const summary = props.perTrailer.find((s) => s.trailerId === trailer.id);
          return (
            <TrailerBlock
              key={trailer.id}
              trailer={trailer}
              trailerIndex={idx + 1}
              summary={summary}
              activeItemId={props.activeId}
              itemsWithResults={itemsWithResults}
              canRemove={props.trailers.length > 1 && !props.simpleMode}
              simpleMode={props.simpleMode}
              onUpdate={(patch) => props.onUpdateTrailer(trailer.id, patch)}
              onRemove={() => props.onRemoveTrailer(trailer.id)}
              onAddItem={() => props.onAddItem(trailer.id)}
              onSelectItem={props.onSelectItem}
              onDeleteItem={props.onDeleteItem}
              onDuplicateItem={props.onDuplicateItem}
            />
          );
        })}

        {/* DragOverlay muestra un "ghost" del item siendo arrastrado */}
        <DragOverlay>
          {draggingItem ? (
            <div className="card p-3 border-bnp-green/60 shadow-lg bg-bg-elevated opacity-90 rotate-2">
              <p className="text-xs font-medium truncate">
                {draggingItem.desc || `Línea ${draggingItem.id}`}
              </p>
              <p className="text-2xs text-text-muted mono">
                {draggingItem.aCliente}″ × {draggingItem.calCliente}GA × {draggingItem.lCliente}′
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Botón agregar trailer — oculto en modo simple (México = un solo flete) */}
      {!props.simpleMode && (
        <button
          onClick={props.onAddTrailer}
          className="card p-3 flex items-center justify-center gap-2 text-text-secondary hover:text-bnp-green hover:border-bnp-green/40 border-dashed transition-colors"
        >
          <Truck className="w-4 h-4" />
          <Plus className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Agregar trailer</span>
        </button>
      )}
    </div>
  );
}
