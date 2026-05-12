'use client';

import { useMemo, useState, useCallback } from 'react';
import type { LineItem } from '@/types';
import {
  newLineItem,
  calcLineItem,
  calcTrailerTotals,
} from '@/lib/pricingEngine';
import { generatePOPDF, generateQuotePDF, savePDF } from '@/lib/pdfGenerator';

import TopBar from './components/TopBar';
import ItemList from './components/ItemList';
import TabPedido from './components/TabPedido';
import TabSugerencia from './components/TabSugerencia';
import FeedbackButton from './components/FeedbackButton';
import { Layers, Sparkles, Save } from 'lucide-react';

export default function CotizadorPage() {
  // Estado global del camión - arranca vacío para que cada vendedor cotice desde cero
  const [cliente, setCliente] = useState('');
  const [tc, setTc] = useState(18.5);
  const [transportUSD, setTransportUSD] = useState(0);
  const [items, setItems] = useState<LineItem[]>([newLineItem(1)]);
  const [activeId, setActiveId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'pedido' | 'sugerencia'>('pedido');

  // Cálculos derivados (en orden: trailer totals primero, luego cada item)
  const trailerTotals = useMemo(
    () => calcTrailerTotals(items, tc, transportUSD),
    [items, tc, transportUSD],
  );

  const results = useMemo(
    () =>
      items.map((item) =>
        calcLineItem(item, tc, transportUSD, trailerTotals.kgNetoTotal),
      ),
    [items, tc, transportUSD, trailerTotals.kgNetoTotal],
  );

  const activeIndex = items.findIndex((i) => i.id === activeId);
  const activeItem = items[activeIndex] ?? items[0];
  const activeResult = results[activeIndex] ?? results[0];

  // Mutaciones
  const updateActive = useCallback(
    (patch: Partial<LineItem>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === activeId ? { ...it, ...patch } : it)),
      );
    },
    [activeId],
  );

  const addItem = useCallback(() => {
    setItems((prev) => {
      const nextId = (prev[prev.length - 1]?.id ?? 0) + 1;
      const next = newLineItem(nextId);
      // Heredar costo base del item activo para no re-tipear todo
      const active = prev.find((i) => i.id === activeId);
      if (active) {
        next.costoBase = active.costoBase;
        next.refilado = active.refilado;
        next.tipoResina = active.tipoResina;
        next.cono = active.cono;
        next.rollosPallet = active.rollosPallet;
        next.palletTrailer = active.palletTrailer;
      }
      setActiveId(nextId);
      return [...prev, next];
    });
  }, [activeId]);

  const deleteItem = useCallback(
    (id: number) => {
      setItems((prev) => {
        const filtered = prev.filter((i) => i.id !== id);
        if (filtered.length === 0) return prev;
        if (id === activeId) {
          setActiveId(filtered[0].id);
        }
        return filtered;
      });
    },
    [activeId],
  );

  const duplicateItem = useCallback(
    (id: number) => {
      setItems((prev) => {
        const original = prev.find((i) => i.id === id);
        if (!original) return prev;
        const nextId = (prev[prev.length - 1]?.id ?? 0) + 1;
        const copy = { ...original, id: nextId, desc: `${original.desc} (copia)` };
        setActiveId(nextId);
        return [...prev, copy];
      });
    },
    [],
  );

  // Generadores de PDF
  const handleGenerateQuote = () => {
    const meta = {
      cliente,
      contacto: 'Chad Bartling',
      direccion: 'EVANS FREIGHT\n2060 Williams Rd\nColumbus OH 43207',
      fecha: new Date().toLocaleDateString('en-US'),
      numero: `Q-${Date.now().toString().slice(-6)}`,
      vendedor: 'Evers Lopez',
      tc,
      transportUSD,
    };
    const doc = generateQuotePDF(items, results, meta);
    savePDF(doc, `Quotation_${cliente.replace(/\s+/g, '_')}_${meta.numero}.pdf`);
  };

  const handleGeneratePO = () => {
    const meta = {
      cliente: 'EXTRUIDOS DE POLIETILENO S.A. DE C.V.',
      fecha: new Date().toLocaleDateString('en-US'),
      numero: `PO-${Date.now().toString().slice(-6)}`,
      vendedor: 'Evers Lopez',
      tc,
      transportUSD,
    };
    const doc = generatePOPDF(items, results, meta);
    savePDF(doc, `PurchaseOrder_${meta.numero}.pdf`);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <TopBar
        cliente={cliente}
        onClienteChange={setCliente}
        fecha={new Date().toLocaleDateString('es-MX')}
        tc={tc}
        onTcChange={setTc}
        transportUSD={transportUSD}
        onTransportChange={setTransportUSD}
        totalRevenue={trailerTotals.totalRevenueUSD}
        totalCost={trailerTotals.totalCostUSD}
        utilidadGlobal={trailerTotals.utilidadGlobal}
        kgNetoTotal={trailerTotals.kgNetoTotal}
      />

      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Sidebar: lista de líneas */}
        <aside className="col-span-3 max-h-[calc(100vh-180px)]">
          <ItemList
            items={items}
            results={results}
            activeId={activeId}
            onSelect={setActiveId}
            onAdd={addItem}
            onDelete={deleteItem}
            onDuplicate={duplicateItem}
          />
        </aside>

        {/* Panel central: tabs */}
        <main className="col-span-9 overflow-y-auto max-h-[calc(100vh-180px)]">
          <div className="border-b border-border mb-4 flex items-center justify-between">
            <div className="flex">
              <button
                onClick={() => setActiveTab('pedido')}
                className={`tab ${activeTab === 'pedido' ? 'tab-active' : ''}`}
              >
                <Layers className="w-3.5 h-3.5 inline -mt-0.5 mr-1.5" />
                Pedido del cliente
              </button>
              <button
                onClick={() => setActiveTab('sugerencia')}
                className={`tab ${activeTab === 'sugerencia' ? 'tab-active' : ''}`}
              >
                <Sparkles className="w-3.5 h-3.5 inline -mt-0.5 mr-1.5" />
                Sugerencia para planta
              </button>
            </div>
            <button
              className="btn-secondary text-xs mb-1.5"
              onClick={() => alert('Guardado en Supabase pendiente — configurar env vars')}
            >
              <Save className="w-3.5 h-3.5" />
              Guardar borrador
            </button>
          </div>

          {activeTab === 'pedido' ? (
            <TabPedido
              item={activeItem}
              result={activeResult}
              onChange={updateActive}
            />
          ) : (
            <TabSugerencia
              item={activeItem}
              result={activeResult}
              onChange={updateActive}
              onGenerateQuote={handleGenerateQuote}
              onGeneratePO={handleGeneratePO}
            />
          )}
        </main>
      </div>

      <FeedbackButton />
    </div>
  );
}
