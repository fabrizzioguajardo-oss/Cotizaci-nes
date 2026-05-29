'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { LineItem, Trailer } from '@/types';
import {
  newLineItem,
  TRAILER_MAX_KG,
} from '@/lib/pricingEngine';
import { generatePOPDF, generateQuotePDF, savePDF } from '@/lib/pdfGenerator';
import { useCotizacionAutosave } from '@/lib/useCotizacionAutosave';
import { computeQuote, partitionWarnings, type QuoteResult } from '@/lib/computeQuote';
import { buildSnapshot, type SnapshotMeta } from '@/lib/snapshotEmitida';
import { useAuth } from '@/lib/useAuth';

import TopBar from './components/TopBar';
import TrailerStack from './components/TrailerStack';
import TabPedido from './components/TabPedido';
import TabSugerencia from './components/TabSugerencia';
import FeedbackButton from './components/FeedbackButton';
import AutosaveIndicator from './components/AutosaveIndicator';
import OnboardingNameModal from './components/OnboardingNameModal';
import { Layers, Sparkles, FilePlus } from 'lucide-react';

// Factory para crear un trailer nuevo con defaults
function newTrailer(id: number, destino = ''): Trailer {
  return { id, destino, transport_usd: 0, kg_max: TRAILER_MAX_KG };
}

export default function CotizadorPage() {
  // Sesión del usuario actual — usado para firmar PDFs con el vendedor real.
  const { profile, refreshProfile } = useAuth();

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

  // ÚNICO punto de cálculo: computeQuote es el entry point que también
  // alimenta los PDFs, el snapshot y los warnings. Antes la UI calculaba
  // `results` y `trailerTotals` por su cuenta (duplicando la fórmula que vive
  // en computeQuote), y luego confirmarAntesPDF/persistirSnapshot llamaban
  // computeQuote OTRAS dos veces por click. Ahora todo sale de este `quote`.
  const quote: QuoteResult = useMemo(
    () => computeQuote(items, trailers, tc),
    [items, trailers, tc],
  );
  const results = quote.perItem;
  // Shape de compatibilidad para los consumidores que esperaban `trailerTotals`.
  const trailerTotals = {
    perTrailer: quote.perTrailer,
    totalRevenueUSD: quote.totals.revenueUSD,
    totalCostUSD: quote.totals.costUSD,
    utilidadGlobal: quote.totals.utilidadGlobal,
    kgNetoTotal: quote.totals.kgNetoTotal,
  };

  // Suma de fletes — SOLO de trailers que efectivamente llevan líneas. Sin
  // este filtro, un trailer creado por error o vaciado al arrastrar todas
  // sus líneas a otro seguiría sumando su `transport_usd` al total — el
  // PDF al cliente le cobraría "Shipment: $X" por un camión que no lleva
  // nada. (Bug detectado por el Adversario en la auditoría.)
  const trailerIdsConItems = new Set(items.map((it) => it.trailerId));
  const transportUSDTotal = trailers
    .filter((t) => trailerIdsConItems.has(t.id))
    .reduce((a, t) => a + t.transport_usd, 0);

  const activeIndex = items.findIndex((i) => i.id === activeId);
  const activeItem = items[activeIndex] ?? items[0];
  const activeResult = results[activeIndex] ?? results[0];

  // === AUTO-SAVE de borradores ===
  const autosave = useCotizacionAutosave({
    cliente,
    contacto,
    direccion,
    tc,
    transport_usd: transportUSDTotal,
    total_revenue_usd: trailerTotals.totalRevenueUSD,
    total_cost_usd: trailerTotals.totalCostUSD,
    utilidad_global: trailerTotals.utilidadGlobal,
    items,
    trailers,
    enabled: autosaveEnabled,
  });

  // Cargar el draft del usuario al montar.
  // Backwards compat: si items vienen sin trailerId, se asignan al trailer 1.
  useEffect(() => {
    if (draftLoaded) return;
    autosave.loadDraft().then((draft) => {
      if (draft && draft.items && draft.items.length > 0) {
        setCliente(draft.cliente || '');
        setContacto(draft.contacto || '');
        setDireccion(draft.direccion || '');
        // tc del draft solo si es un valor usable (>0). Un tc de 0 no es un
        // tipo de cambio válido (rompe las conversiones), así que defaulteamos.
        setTc(typeof draft.tc === 'number' && draft.tc > 0 ? draft.tc : 18.5);
        // Migración doble de items:
        //  - trailerId: items viejos sin trailer → trailer 1.
        //  - conoCliente: items previos a v1.16 no lo tienen → inicializar
        //    al cono real (en esos drafts cono == lo que el cliente esperaba).
        const migrated = draft.items.map((it) => ({
          ...it,
          trailerId: it.trailerId ?? 1,
          conoCliente: it.conoCliente ?? it.cono ?? 0,
        }));
        setItems(migrated);
        // Restaurar el arreglo COMPLETO de trailers (destino, kg_max, flete por
        // trailer). Antes solo se reconstruía un trailer 1 con el flete
        // agregado, lo que dejaba huérfanos a los items de trailers 2/3 en
        // cotizaciones multi-trailer. Fallback: drafts viejos sin `trailers`
        // → reconstruir trailer 1 con el transport_usd agregado (comportamiento
        // legacy), preservando además cualquier trailerId referenciado por los
        // items para no orfanarlos.
        if (draft.trailers && draft.trailers.length > 0) {
          setTrailers(draft.trailers);
        } else {
          const referenced = Array.from(new Set(migrated.map((it) => it.trailerId)));
          setTrailers(
            referenced.map((id) => ({
              id,
              destino: '',
              transport_usd: id === 1 ? (draft.transport_usd ?? 0) : 0,
              kg_max: TRAILER_MAX_KG,
            })),
          );
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
    setContacto('');
    setDireccion('');
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

  // Persiste el snapshot inmutable de la cotización emitida en
  // cotizaciones_emitidas. Se llama justo antes de descargar el PDF.
  // Si falla (red caída, RLS, schema desactualizado), NO bloquea la
  // descarga — solo loguea y avisa al vendedor — porque el papel
  // del cliente es prioritario sobre el histórico interno.
  const persistirSnapshot = async (
    tipo: 'quote' | 'po',
    numero: string,
    meta: SnapshotMeta,
  ): Promise<void> => {
    try {
      // Reusa el `quote` memorizado (el servidor lo recalcula igual al guardar).
      const snapshot = buildSnapshot({
        items,
        trailers,
        quote,
        meta,
        snapshotAt: new Date().toISOString(),
      });
      const res = await fetch('/api/cotizaciones/emitidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, numero, snapshot }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // eslint-disable-next-line no-console
        console.warn('[snapshot]', res.status, data);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[snapshot] persist failed', err);
    }
  };

  // Verifica las invariantes de negocio (PB≤PB_cliente, margen≥12%,
  // capacidad trailer, spec completo) antes de generar PDFs. Si hay
  // violaciones, pide confirmación al vendedor con el detalle.
  // Retorna true si se puede proceder, false si el vendedor canceló.
  const confirmarAntesPDF = (tipo: 'cotización al cliente' | 'PO a Extruidos'): boolean => {
    // Reusa el `quote` memorizado en vez de recalcular.
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

  // Identidad del vendedor para firmar PDFs. Solo el nombre real del profile.
  const vendedorFirma = profile?.name?.trim() ?? '';

  // Guard: ningún PDF puede generarse sin un nombre de vendedor real. Cubre
  // el caso donde profile es null (sesión no cargó, RLS falló, trigger no
  // creó el perfil) — en ese caso el modal de onboarding NO aparece (su gate
  // es `profile && !profile.name`), así que sin este guard un PDF saldría
  // firmado con un genérico. Si no hay nombre, bloqueamos y mandamos al
  // vendedor a configurarlo.
  const tieneNombreVendedor = (): boolean => {
    if (vendedorFirma) return true;
    window.alert(
      'Antes de generar PDFs necesitas configurar tu nombre (aparece como firma en el documento). ' +
        'Si no ves la ventana para hacerlo, recarga la página; si el problema sigue, contacta al admin.',
    );
    return false;
  };

  // Genera un número de documento con suficiente entropía para no colisionar.
  // Antes era `Date.now().toString().slice(-6)` (6 dígitos) — dos emisiones
  // cercanas, o de distintos vendedores en el mismo instante, podían chocar y
  // el registro histórico perdía trazabilidad. Ahora: ms en base36 (único por
  // milisegundo) + 3 chars aleatorios (rompe colisiones en el mismo ms).
  const genNumero = (prefijo: 'Q' | 'PO'): string => {
    const ms = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `${prefijo}-${ms}${rand}`;
  };

  // Generadores de PDF. El PDF se descarga PRIMERO (lo que el cliente espera);
  // el snapshot inmutable se persiste DESPUÉS y en fire-and-forget. Antes se
  // hacía `await persistirSnapshot` ANTES del PDF, así que una red lenta
  // retrasaba la descarga — contradecía el diseño "el papel del cliente es
  // prioritario". Si el snapshot falla, se loguea y no afecta la descarga.
  const handleGenerateQuote = () => {
    if (!tieneNombreVendedor()) return;
    if (!confirmarAntesPDF('cotización al cliente')) return;
    const meta = {
      cliente,
      contacto,
      direccion,
      fecha: new Date().toLocaleDateString('en-US'),
      numero: genNumero('Q'),
      vendedor: vendedorFirma,
      tc,
      transportUSD: transportUSDTotal,
    };
    const doc = generateQuotePDF(items, results, meta);
    savePDF(doc, `Quotation_${(cliente || 'cliente').replace(/\s+/g, '_')}_${meta.numero}.pdf`);
    void persistirSnapshot('quote', meta.numero, {
      cliente: meta.cliente,
      contacto: meta.contacto,
      direccion: meta.direccion,
      vendedor: meta.vendedor,
      fecha: meta.fecha,
      numero: meta.numero,
      tc: meta.tc,
      transportUSDActivo: transportUSDTotal,
    });
  };

  const handleGeneratePO = () => {
    if (!tieneNombreVendedor()) return;
    if (!confirmarAntesPDF('PO a Extruidos')) return;
    const meta = {
      cliente: 'EXTRUIDOS DE POLIETILENO S.A. DE C.V.',
      fecha: new Date().toLocaleDateString('en-US'),
      numero: genNumero('PO'),
      vendedor: vendedorFirma,
      tc,
      transportUSD: transportUSDTotal,
    };
    const doc = generatePOPDF(items, results, meta);
    savePDF(doc, `PurchaseOrder_${meta.numero}.pdf`);
    void persistirSnapshot('po', meta.numero, {
      cliente: meta.cliente,
      vendedor: meta.vendedor,
      fecha: meta.fecha,
      numero: meta.numero,
      tc: meta.tc,
      transportUSDActivo: transportUSDTotal,
    });
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
              tc={tc}
              onChange={updateActive}
              onGenerateQuote={handleGenerateQuote}
              onGeneratePO={handleGeneratePO}
            />
          )}
        </main>
      </div>

      <FeedbackButton />

      {/* Modal bloqueante: si el profile cargó y NO tiene name, forzamos
          al vendedor a escribirlo antes de cotizar. Garantiza que los PDFs
          jamás salgan firmados con el email del usuario.
          (Bug que arregla: hasta v1.11 los nombres se derivaban del email
          porque el magic link no captura nombre y nadie había llenado
          user_profiles.name manualmente.) */}
      {profile && !profile.name?.trim() && (
        <OnboardingNameModal
          open={true}
          mode="onboarding"
          initialEmail={profile.email}
          onSaved={() => {
            // Re-lee el profile sin recargar la página (antes hacía reload, que
            // descartaba cualquier trabajo en la ventana de debounce del autosave).
            void refreshProfile();
          }}
        />
      )}
    </div>
  );
}
