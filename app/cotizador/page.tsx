'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { LineItem, Trailer } from '@/types';
import {
  newLineItem,
  calcLineItem,
  calcAllTrailerTotals,
  TRAILER_MAX_KG,
} from '@/lib/pricingEngine';
import { generatePOPDF, generateQuotePDF, savePDF } from '@/lib/pdfGenerator';
import { useCotizacionAutosave } from '@/lib/useCotizacionAutosave';
import { computeQuote, partitionWarnings } from '@/lib/computeQuote';
import { useAuth } from '@/lib/useAuth';

import TopBar from './components/TopBar';
import TrailerStack from './components/TrailerStack';
import TabPedido from './components/TabPedido';
import TabSugerencia from './components/TabSugerencia';
import FeedbackButton from './components/FeedbackButton';
import AutosaveIndicator from './components/AutosaveIndicator';
import { Layers, Sparkles, FilePlus } from 'lucide-react';

// Factory para crear un trailer nuevo con defaults
function newTrailer(id: number, destino = ''): Trailer {
  return { id, destino, transport_usd: 0, kg_max: TRAILER_MAX_KG };
}

export default function CotizadorPage() {
  // Sesión del usuario actual — usado para firmar PDFs con el vendedor real.
  const { profile } = useAuth();

  // Estado global del camión - arranca vacío para que cada vendedor cotice desde cero
  const [cliente, setCliente] = useState('');
  // Contacto + direccion: editables en TopBar. Reemplazan los defaults
  // hardcoded ('Chad Bartling' / 'EVANS FREIGHT ...') que salían en cada
  // cotización aunque fuera para otro cliente.
  // NOTA: por ahora solo persisten en sesión — el draft autosave todavía
  // no los guarda (task #18 lo arregla en push siguiente).
  const [contacto, setContacto] = useState('');
  const [direccion, setDireccion] = useState('');
  const [tc, setTc] = useState(18.5);

  // Multi-trailer: el pedido se compone de uno o más camiones, cada uno con
  // su propio costo logístico y capacidad. Default: 1 trailer.
  const [trailers, setTrailers] = useState<Trailer[]>([newTrailer(1)]);
  const [items, setItems] = useState<LineItem[]>([newLineItem(1, 1)]);
  const [activeId, setActiveId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'pedido' | 'sugerencia'>('pedido');

  // Bandera para evitar que el autosave dispare durante la carga inicial del draft
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Cálculos derivados (multi-trailer aware)
  const trailerTotals = useMemo(
    () => calcAllTrailerTotals(items, trailers, tc),
    [items, trailers, tc],
  );

  // Para legacy: el flete distribuido depende del trailer al que pertenece la línea
  const results = useMemo(
    () =>
      items.map((item) => {
        const trailerSummary = trailerTotals.perTrailer.find((t) => t.trailerId === item.trailerId);
        const trailer = trailers.find((t) => t.id === item.trailerId);
        const kgTrailer = trailerSummary?.kgNetoTotal ?? 0;
        const transportTrailer = trailer?.transport_usd ?? 0;
        return calcLineItem(item, tc, transportTrailer, kgTrailer);
      }),
    [items, trailers, tc, trailerTotals.perTrailer],
  );

  // Para compatibilidad con TopBar (que muestra "transport USD" global, no por trailer)
  // Mostramos la suma de todos los trailers
  const transportUSDTotal = trailers.reduce((a, t) => a + t.transport_usd, 0);

  const activeIndex = items.findIndex((i) => i.id === activeId);
  const activeItem = items[activeIndex] ?? items[0];
  const activeResult = results[activeIndex] ?? results[0];

  // === AUTO-SAVE de borradores ===
  const autosave = useCotizacionAutosave({
    cliente,
    tc,
    transport_usd: transportUSDTotal,
    total_revenue_usd: trailerTotals.totalRevenueUSD,
    total_cost_usd: trailerTotals.totalCostUSD,
    utilidad_global: trailerTotals.utilidadGlobal,
    items,
    enabled: autosaveEnabled,
  });

  // Cargar el draft del usuario al montar.
  // Backwards compat: si items vienen sin trailerId, se asignan al trailer 1.
  useEffect(() => {
    if (draftLoaded) return;
    autosave.loadDraft().then((draft) => {
      if (draft && draft.items && draft.items.length > 0) {
        setCliente(draft.cliente || '');
        setTc(draft.tc || 18.5);
        // Migración: items sin trailerId → asignar a trailer 1
        const migrated = draft.items.map((it) =>
          it.trailerId ? it : { ...it, trailerId: 1 },
        );
        setItems(migrated);
        // El draft viejo solo tenia 1 transport_usd, lo asignamos al trailer 1
        if (draft.transport_usd) {
          setTrailers([{ id: 1, destino: '', transport_usd: draft.transport_usd, kg_max: TRAILER_MAX_KG }]);
        }
        const firstId = migrated[0]?.id ?? 1;
        setActiveId(firstId);
      }
      setDraftLoaded(true);
      // Habilitar autosave después de un pequeño delay para que el state se asiente
      setTimeout(() => setAutosaveEnabled(true), 500);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Botón "Nueva cotización" — borra draft en BD y resetea el estado local
  const handleNuevaCotizacion = useCallback(async () => {
    if (!confirm('¿Iniciar una cotización nueva? El borrador actual se borrará.')) return;
    setAutosaveEnabled(false);
    await autosave.clearDraft();
    setCliente('');
    setTc(18.5);
    setTrailers([newTrailer(1)]);
    const fresh = newLineItem(1, 1);
    setItems([fresh]);
    setActiveId(fresh.id);
    setActiveTab('pedido');
    setTimeout(() => setAutosaveEnabled(true), 500);
  }, [autosave]);

  // Mutaciones de trailers
  const addTrailer = useCallback(() => {
    setTrailers((prev) => {
      const nextId = Math.max(0, ...prev.map((t) => t.id)) + 1;
      return [...prev, newTrailer(nextId)];
    });
  }, []);

  const removeTrailer = useCallback((id: number) => {
    setTrailers((prev) => {
      if (prev.length <= 1) return prev; // no permitir borrar el último
      const remaining = prev.filter((t) => t.id !== id);
      const fallback = remaining[0]?.id ?? 1;
      // Reasignar items del trailer borrado al primero disponible
      setItems((its) => its.map((it) => (it.trailerId === id ? { ...it, trailerId: fallback } : it)));
      return remaining;
    });
  }, []);

  const updateTrailer = useCallback((id: number, patch: Partial<Trailer>) => {
    setTrailers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  // Mover una línea a un trailer distinto (drag-and-drop)
  const moveItemToTrailer = useCallback((itemId: number, trailerId: number) => {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, trailerId } : it)));
  }, []);

  // Mutaciones
  const updateActive = useCallback(
    (patch: Partial<LineItem>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === activeId ? { ...it, ...patch } : it)),
      );
    },
    [activeId],
  );

  const addItem = useCallback((targetTrailerId?: number) => {
    setItems((prev) => {
      const nextId = (prev[prev.length - 1]?.id ?? 0) + 1;
      const active = prev.find((i) => i.id === activeId);
      // Si no se especificó trailer, usa el del item activo o el primero
      const trailerId = targetTrailerId ?? active?.trailerId ?? 1;
      const next = newLineItem(nextId, trailerId);
      // Heredar SOLO datos del trailer compartido (tipo resina, config logistica
      // de tarima) del item activo. NO heredar adders ni precios — cada linea
      // tiene su propio mix de master/intenso/aditivo/refilado/caja segun el
      // producto especifico. El cone selector autollenara costoBase, master,
      // intenso cuando el vendedor escoja.
      if (active) {
        next.tipoResina = active.tipoResina;
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

  // Verifica las invariantes de negocio (PB≤PB_cliente, margen≥12%,
  // capacidad trailer, spec completo) antes de generar PDFs. Si hay
  // violaciones, pide confirmación al vendedor con el detalle.
  // Retorna true si se puede proceder, false si el vendedor canceló.
  const confirmarAntesPDF = (tipo: 'cotización al cliente' | 'PO a Extruidos'): boolean => {
    const quote = computeQuote(items, trailers, tc);
    const { errors, warns } = partitionWarnings(quote.warnings);
    if (errors.length === 0 && warns.length === 0) return true;

    const lineas: string[] = [];
    if (errors.length > 0) {
      lineas.push(`⚠ ${errors.length} error${errors.length === 1 ? '' : 'es'}:`);
      for (const e of errors) lineas.push(`  • ${e.message}`);
    }
    if (warns.length > 0) {
      lineas.push(`${errors.length > 0 ? '\n' : ''}${warns.length} advertencia${warns.length === 1 ? '' : 's'}:`);
      for (const w of warns) lineas.push(`  • ${w.message}`);
    }
    lineas.push(`\n¿Generar la ${tipo} de todos modos?`);
    return window.confirm(lineas.join('\n'));
  };

  // Identidad del vendedor para firmar PDFs. Si por alguna razón el profile
  // no cargó (sesión nueva, fallback de admin), usamos el email o un
  // genérico — pero nunca volvemos al 'Evers Lopez' hardcoded del pasado.
  const vendedorFirma =
    profile?.name?.trim() ||
    profile?.email?.split('@')[0] ||
    'BioNovaPack LLC';

  // Generadores de PDF
  const handleGenerateQuote = () => {
    if (!confirmarAntesPDF('cotización al cliente')) return;
    const meta = {
      cliente,
      contacto,
      direccion,
      fecha: new Date().toLocaleDateString('en-US'),
      numero: `Q-${Date.now().toString().slice(-6)}`,
      vendedor: vendedorFirma,
      tc,
      transportUSD: transportUSDTotal,
    };
    const doc = generateQuotePDF(items, results, meta);
    savePDF(doc, `Quotation_${(cliente || 'cliente').replace(/\s+/g, '_')}_${meta.numero}.pdf`);
  };

  const handleGeneratePO = () => {
    if (!confirmarAntesPDF('PO a Extruidos')) return;
    const meta = {
      cliente: 'EXTRUIDOS DE POLIETILENO S.A. DE C.V.',
      fecha: new Date().toLocaleDateString('en-US'),
      numero: `PO-${Date.now().toString().slice(-6)}`,
      vendedor: vendedorFirma,
      tc,
      transportUSD: transportUSDTotal,
    };
    const doc = generatePOPDF(items, results, meta);
    savePDF(doc, `PurchaseOrder_${meta.numero}.pdf`);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <TopBar
        cliente={cliente}
        onClienteChange={setCliente}
        contacto={contacto}
        onContactoChange={setContacto}
        direccion={direccion}
        onDireccionChange={setDireccion}
        fecha={new Date().toLocaleDateString('es-MX')}
        tc={tc}
        onTcChange={setTc}
        totalRevenue={trailerTotals.totalRevenueUSD}
        totalCost={trailerTotals.totalCostUSD}
        utilidadGlobal={trailerTotals.utilidadGlobal}
        kgNetoTotal={trailerTotals.kgNetoTotal}
      />

      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Sidebar: bloques de trailer estilo Scratch */}
        <aside className="col-span-3 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
          <TrailerStack
            trailers={trailers}
            items={items}
            results={results}
            perTrailer={trailerTotals.perTrailer}
            activeId={activeId}
            onSelectItem={setActiveId}
            onAddItem={addItem}
            onDeleteItem={deleteItem}
            onDuplicateItem={duplicateItem}
            onAddTrailer={addTrailer}
            onRemoveTrailer={removeTrailer}
            onUpdateTrailer={updateTrailer}
            onMoveItem={moveItemToTrailer}
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
            <div className="flex items-center gap-3 mb-1.5">
              <AutosaveIndicator
                status={autosave.status}
                lastSavedAt={autosave.lastSavedAt}
                errorMessage={autosave.errorMessage}
              />
              <button
                className="btn-secondary text-xs"
                onClick={handleNuevaCotizacion}
                title="Borra el borrador actual y arranca uno nuevo"
              >
                <FilePlus className="w-3.5 h-3.5" />
                Nueva cotización
              </button>
            </div>
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
