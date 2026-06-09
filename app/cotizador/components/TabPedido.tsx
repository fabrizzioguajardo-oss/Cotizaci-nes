'use client';

import type { LineItem, CalcResult } from '@/types';
import LineItemEditor from './LineItemEditor';
import ResultsStrip from './ResultsStrip';
import MarginBar from './MarginBar';

interface Props {
  item: LineItem;
  result: CalcResult;
  esMexico?: boolean;   // muestra el campo "precio anterior" (formato Extruidos)
  onChange: (patch: Partial<LineItem>) => void;
}

// Tab 1 - Pedido del cliente
// Layout: editor central + métricas debajo
export default function TabPedido({ item, result, esMexico, onChange }: Props) {
  // Los resultados (tira de KPIs + barra de margen) solo aparecen cuando ya hay
  // un precio capturado. Antes salían SIEMPRE, en ceros, llenando la pantalla de
  // celdas vacías antes de que el vendedor capturara nada.
  const tienePrecio = item.precioCliente > 0;
  return (
    <div className="space-y-4">
      {tienePrecio && (
        <>
          <ResultsStrip result={result} precioCliente={item.precioCliente} />
          <div className="card p-3">
            <MarginBar utilidad={result.utilidad} />
          </div>
        </>
      )}

      <div className="card p-5">
        <LineItemEditor item={item} result={result} esMexico={esMexico} onChange={onChange} />
      </div>
    </div>
  );
}
