'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { LineItem, Trailer, TipoCotizacion, Empresa, TransporteMX, FormaPago } from '@/types';
import { FORMA_PAGO_LABEL } from '@/types';
import {
  newLineItem,
  calcLineItem,
  conoEsperado,
  TRAILER_MAX_KG,
  REDUCTION_WARN_HIGH,
} from '@/lib/pricingEngine';
import { empresaInfo, tcEfectivo, monedaDe } from '@/lib/empresa';
import { generatePOPDF, generateQuotePDF, generateExtruidosQuotePDF, savePDF, loadLogo, type ExtruidosMeta } from '@/lib/pdfGenerator';
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
import { Layers, Sparkles, FilePlus, ShieldAlert } from 'lucide-react';

// Factory para crear un trailer nuevo con defaults
function newTrailer(id: number, destino = ''): Trailer {
  return { id, destino, transport_usd: 0, kg_max: TRAILER_MAX_KG };
}

export default function CotizadorPage() {
  // Sesión del usuario actual — usado para firmar PDFs con el vendedor real.
  const { profile, refreshProfile } = useAuth();

  // Empresa / mercado para el que se cotiza (v1.23). Default BioNovaPack (USA).
  // Determina moneda (USD/MXN), si usa tipo de cambio, y el modelo de transporte.
  const [empresa, setEmpresa] = useState<Empresa>('bionovapack');
  // Transporte para México (Extruidos): recoge en almacén o envío por Castores.
  const [transporteMX, setTransporteMX] = useState<TransporteMX>('pickup');
  // Datos de cotización México (formato Extruidos).
  const [correoCliente, setCorreoCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [formaPago, setFormaPago] = useState<FormaPago>('contado');
  const [anticipo, setAnticipo] = useState(0);

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
  // Modo de cotización (v1.21). Default 'directa' = se fabrica tal cual el
  // cliente pidió, sin optimización.
  const [tipoCotizacion, setTipoCotizacion] = useState<TipoCotizacion>('directa');
  // Aprobación (v1.22): nombre de quien aprueba + timestamp. Solo aplica en
  // modo 'optimizada_revision' cuando algún spec crítico (reducción > 35%) se
  // dispara. aprobadoEn se setea al confirmar la casilla.
  const [aprobadoPor, setAprobadoPor] = useState('');
  const [aprobadoEn, setAprobadoEn] = useState<string | null>(null);

  // Multi-trailer: el pedido se compone de uno o más camiones, cada uno con
  // su propio costo logístico y capacidad. Default: 1 trailer.
  const [trailers, setTrailers] = useState<Trailer[]>([newTrailer(1)]);
  const [items, setItems] = useState<LineItem[]>([newLineItem(1, 1)]);
  // Candado de reentrada: evita que un doble-clic (o un re-clic mientras la
  // descarga aún no aparece) emita la MISMA cotización dos veces y cree dos
  // registros "inmutables" duplicados. Se libera en el finally del handler.
  const emitiendoRef = useRef(false);
  const [activeId, setActiveId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'pedido' | 'sugerencia'>('pedido');

  // Bandera para evitar que el autosave dispare durante la carga inicial del draft
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Info de la empresa activa + tipo de cambio EFECTIVO para los cálculos.
  // En México (Extruidos) el costo ya está en MXN y el precio se captura en
  // MXN, así que el divisor es 1 (no se convierte). En EUA se usa el TC real.
  const info = empresaInfo(empresa);
  const moneda = monedaDe(empresa);
  const tcCalc = tcEfectivo(empresa, tc);

  // ÚNICO punto de cálculo: computeQuote es el entry point que también
  // alimenta los PDFs, el snapshot y los warnings. Antes la UI calculaba
  // `results` y `trailerTotals` por su cuenta (duplicando la fórmula que vive
  // en computeQuote), y luego confirmarAntesPDF/persistirSnapshot llamaban
  // computeQuote OTRAS dos veces por click. Ahora todo sale de este `quote`.
  const quote: QuoteResult = useMemo(
    () => computeQuote(items, trailers, tcCalc),
    [items, trailers, tcCalc],
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

  // Resultado "directo" del item activo: fabricar EXACTAMENTE lo que pide el
  // cliente (spec real = spec cliente, cono = conoCliente). Es la base de la
  // comparación económica vs la propuesta optimizada. Usa el mismo contexto de
  // flete del trailer (aproximación de Fase 1: el flete/kg cambiaría un poco
  // con el PN directo, pero la diferencia dominante — largo/material — sí se
  // captura).
  const activeDirectResult = useMemo(() => {
    if (!activeItem) return null;
    const summary = trailerTotals.perTrailer.find((t) => t.trailerId === activeItem.trailerId);
    const trailer = trailers.find((t) => t.id === activeItem.trailerId);
    const directItem: LineItem = {
      ...activeItem,
      aReal: activeItem.aCliente,
      calReal: activeItem.calCliente,
      lReal: activeItem.lCliente,
      cono: activeItem.conoCliente,
    };
    return calcLineItem(directItem, tcCalc, trailer?.transport_usd ?? 0, summary?.kgNetoTotal ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem, trailers, tcCalc, trailerTotals.perTrailer]);

  // ¿La cotización requiere aprobación? Solo en modo 'optimizada_revision' y
  // cuando alguna línea tiene reducción de material > 35% (la spec crítica
  // elegida). materialReduction lo trae cada CalcResult.
  const requiereAprobacion =
    tipoCotizacion === 'optimizada_revision' &&
    results.some((r) => r.materialReduction > REDUCTION_WARN_HIGH);

  // Cualquier cambio en items o en el modo invalida una aprobación previa
  // (no se puede aprobar algo y luego cambiar lo que se va a emitir).
  useEffect(() => {
    setAprobadoEn(null);
  }, [items, tipoCotizacion]);

  // === AUTO-SAVE de borradores ===
  const autosave = useCotizacionAutosave({
    cliente,
    contacto,
    direccion,
    tipo_cotizacion: tipoCotizacion,
    empresa,
    transporte_mx: transporteMX,
    correo_cliente: correoCliente,
    telefono_cliente: telefonoCliente,
    forma_pago: formaPago,
    anticipo,
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
        if (draft.tipo_cotizacion === 'directa' || draft.tipo_cotizacion === 'optimizada' || draft.tipo_cotizacion === 'optimizada_revision') {
          setTipoCotizacion(draft.tipo_cotizacion);
        }
        if (draft.empresa === 'bionovapack' || draft.empresa === 'extruidos') {
          setEmpresa(draft.empresa);
        }
        if (draft.transporte_mx === 'pickup' || draft.transporte_mx === 'castores') {
          setTransporteMX(draft.transporte_mx);
        }
        setCorreoCliente(draft.correo_cliente || '');
        setTelefonoCliente(draft.telefono_cliente || '');
        if (['contado', 'credito30', 'credito60', 'credito90'].includes(draft.forma_pago ?? '')) {
          setFormaPago(draft.forma_pago as FormaPago);
        }
        setAnticipo(draft.anticipo || 0);
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
          // Mismo criterio que el motor (conoEsperado): un conoCliente en 0 se
          // trata como "no capturado" y cae al cono real, para que UI y motor
          // no modelen el 0 distinto.
          conoCliente: conoEsperado(it.conoCliente ?? 0, it.cono ?? 0),
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

  // Cambio de empresa/mercado. México (Extruidos) no usa multi-trailer:
  // colapsa todo a UN trailer (sin límite de capacidad) y reasigna las líneas
  // a él. Al volver a USA, restaura el kg_max normal del trailer.
  const handleEmpresaChange = useCallback((e: Empresa) => {
    setEmpresa((prevEmpresa) => {
      if (e === prevEmpresa) return prevEmpresa;

      // El cambio de empresa cambia de MONEDA (USD↔MXN). Si hay datos a medias
      // (varias líneas, varios trailers o flete), confirmar — el cambio es
      // destructivo (colapsa trailers, resetea flete y datos del cliente
      // específicos del mercado).
      const hayDatos =
        items.length > 1 ||
        trailers.length > 1 ||
        trailers.some((t) => t.transport_usd > 0) ||
        items.some((it) => it.precioCliente > 0 || it.lCliente > 0);
      if (hayDatos && typeof window !== 'undefined') {
        const ok = window.confirm(
          `Cambiar a ${empresaInfo(e).corto} cambia la moneda y reinicia el transporte y los datos del cliente (correo, teléfono, forma de pago, anticipo). ` +
            (e === 'extruidos' && trailers.length > 1 ? 'Además, las líneas de todos los trailers se juntan en uno solo. ' : '') +
            '¿Continuar?',
        );
        if (!ok) return prevEmpresa;
      }

      const nueva = empresaInfo(e);
      // RESET de transporte y moneda: el flete NO puede arrastrarse entre
      // monedas (un flete MXN reinterpretado como USD, o viceversa, corrompe
      // costo/PDF). Siempre se reinicia a pickup / 0.
      setTransporteMX('pickup');
      // Datos del cliente específicos del mercado: se limpian para no mezclar
      // (ej. anticipo de un cliente México apareciendo en otra cotización).
      setCorreoCliente('');
      setTelefonoCliente('');
      setFormaPago('contado');
      setAnticipo(0);

      if (!nueva.multiTrailer) {
        setItems((prev) => prev.map((it) => ({ ...it, trailerId: 1 })));
        setTrailers((prev) => {
          const t0 = prev[0] ?? newTrailer(1);
          return [{ ...t0, id: 1, destino: '', transport_usd: 0, kg_max: Number.MAX_SAFE_INTEGER }];
        });
      } else {
        setTrailers((prev) =>
          prev.map((t) => ({
            ...t,
            transport_usd: 0,
            kg_max: t.kg_max === Number.MAX_SAFE_INTEGER ? TRAILER_MAX_KG : t.kg_max,
          })),
        );
      }
      return e;
    });
  }, [items, trailers]);

  // En México, el transporte se elige aquí (pickup / Castores) y escribe el
  // flete (MXN) en el único trailer.
  const handleTransporteMX = useCallback((modo: TransporteMX) => {
    setTransporteMX(modo);
    if (modo === 'pickup') {
      setTrailers((prev) => prev.map((t) => ({ ...t, transport_usd: 0 })));
    }
  }, []);

  // Cambio de modo de cotización. En 'directa' sincroniza el spec real al
  // del cliente en TODAS las líneas (fabricar tal cual) y manda a Tab Pedido;
  // en los modos optimizados manda a Tab Sugerencia para ver la comparación.
  const handleModeChange = useCallback((modo: TipoCotizacion) => {
    setTipoCotizacion(modo);
    if (modo === 'directa') {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          aReal: it.aCliente,
          calReal: it.calCliente,
          lReal: it.lCliente,
          cono: it.conoCliente,
        })),
      );
      setActiveTab('pedido');
    } else {
      setActiveTab('sugerencia');
    }
  }, []);

  // Botón "Nueva cotización" — borra draft en BD y resetea el estado local
  const handleNuevaCotizacion = useCallback(async () => {
    if (!confirm('¿Iniciar una cotización nueva? El borrador actual se borrará.')) return;
    setAutosaveEnabled(false);
    await autosave.clearDraft();
    setCliente('');
    setContacto('');
    setDireccion('');
    setTipoCotizacion('directa');
    setEmpresa('bionovapack');
    setTransporteMX('pickup');
    setCorreoCliente('');
    setTelefonoCliente('');
    setFormaPago('contado');
    setAnticipo(0);
    setAprobadoPor('');
    setAprobadoEn(null);
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

  // Gate de tipo de cambio: en EUA (USD) el TC es obligatorio. Si quedó en 0
  // (el vendedor lo borró), las conversiones de costo a USD se corrompen en
  // silencio y el PDF saldría con un precio/margen mal calculado. En México
  // (MXN) no aplica (tc efectivo = 1).
  const tieneTC = (): boolean => {
    if (!info.usaTC || tc > 0) return true;
    window.alert(
      'Falta el tipo de cambio (TC) en la barra de arriba. Sin él, el precio y el margen no se calculan bien. ' +
        'Captúralo antes de generar el documento.',
    );
    return false;
  };

  // Gate de aprobación: en modo 'optimizada + revisión' con una reducción
  // crítica (>35%), no se puede emitir hasta capturar la aprobación.
  const tieneAprobacion = (): boolean => {
    if (!requiereAprobacion || aprobadoEn) return true;
    window.alert(
      'Esta cotización tiene una reducción de material mayor al 35% y está en modo "Optimizada + revisión". ' +
        'Captura la aprobación (escribe el nombre y marca la casilla, arriba) antes de generar el documento.',
    );
    return false;
  };

  // Info de aprobación para el snapshot (historial).
  const aprobacionSnapshot = () =>
    requiereAprobacion && aprobadoEn
      ? { aprobadoPor: aprobadoPor.trim(), aprobadoEn }
      : null;

  // Genera un número de documento con suficiente entropía para no colisionar.
  // Antes era `Date.now().toString().slice(-6)` (6 dígitos) — dos emisiones
  // cercanas, o de distintos vendedores en el mismo instante, podían chocar y
  // el registro histórico perdía trazabilidad. Ahora: ms en base36 (único por
  // milisegundo) + 3 chars aleatorios (rompe colisiones en el mismo ms).
  const genNumero = (prefijo: 'Q' | 'PO' | 'COT'): string => {
    const ms = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `${prefijo}-${ms}${rand}`;
  };

  // Generadores de PDF. El PDF se descarga PRIMERO (lo que el cliente espera);
  // el snapshot inmutable se persiste DESPUÉS y en fire-and-forget. Antes se
  // hacía `await persistirSnapshot` ANTES del PDF, así que una red lenta
  // retrasaba la descarga — contradecía el diseño "el papel del cliente es
  // prioritario". Si el snapshot falla, se loguea y no afecta la descarga.
  const handleGenerateQuote = async () => {
    if (emitiendoRef.current) return; // ya hay una emisión en curso
    if (!tieneNombreVendedor()) return;
    if (!tieneTC()) return;
    if (!tieneAprobacion()) return;
    if (!confirmarAntesPDF('cotización al cliente')) return;
    emitiendoRef.current = true;
    try {
      // México (Extruidos): PDF con formato y marca de Extruidos, en MXN.
      if (empresa === 'extruidos') {
        const numero = genNumero('COT');
        const metaMX: ExtruidosMeta = {
          cliente,
          correo: correoCliente,
          contacto,
          telefono: telefonoCliente,
          fecha: new Date().toLocaleDateString('es-MX'),
          numero,
          formaPago: FORMA_PAGO_LABEL[formaPago],
          anticipo,
          vendedor: vendedorFirma,
          vendedorEmail: profile?.email,
        };
        const logoExt = await loadLogo('/logos/extruidos.jpg', 'JPEG');
        // Pasa el subtotal AUTORITATIVO del motor (en México tc=1, así que
        // revenueUSD ya está en MXN). El servidor recalcula el mismo árbol con
        // computeQuote al guardar el snapshot, así que el PDF firmado y el
        // registro inmutable usan la MISMA cifra — no pueden divergir.
        const doc = generateExtruidosQuotePDF(items, metaMX, logoExt, quote.totals.revenueUSD);
        savePDF(doc, `Cotizacion_Extruidos_${(cliente || 'cliente').replace(/\s+/g, '_')}_${numero}.pdf`);
        void persistirSnapshot('quote', numero, {
          cliente, contacto, direccion,
          vendedor: vendedorFirma,
          fecha: metaMX.fecha, numero, tc: tcCalc,
          transportUSDActivo: transportUSDTotal,
          tipoCotizacion,
          aprobacion: aprobacionSnapshot(),
          empresa,
          moneda,
        });
        return;
      }

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
      const logoBnp = await loadLogo('/logos/bionovapack.png', 'PNG');
      const doc = generateQuotePDF(items, results, meta, logoBnp);
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
        tipoCotizacion,
        aprobacion: aprobacionSnapshot(),
        empresa,
        moneda,
      });
    } finally {
      emitiendoRef.current = false;
    }
  };

  const handleGeneratePO = async () => {
    if (emitiendoRef.current) return; // ya hay una emisión en curso
    if (!tieneNombreVendedor()) return;
    if (!tieneTC()) return;
    if (!tieneAprobacion()) return;
    if (!confirmarAntesPDF('PO a Extruidos')) return;
    emitiendoRef.current = true;
    try {
      const meta = {
        cliente: 'EXTRUIDOS DE POLIETILENO S.A. DE C.V.',
        fecha: new Date().toLocaleDateString('en-US'),
        numero: genNumero('PO'),
        vendedor: vendedorFirma,
        tc,
        transportUSD: transportUSDTotal,
      };
      const logoBnp = await loadLogo('/logos/bionovapack.png', 'PNG');
      const doc = generatePOPDF(items, results, meta, logoBnp);
      savePDF(doc, `PurchaseOrder_${meta.numero}.pdf`);
      void persistirSnapshot('po', meta.numero, {
        cliente: meta.cliente,
        vendedor: meta.vendedor,
        fecha: meta.fecha,
        numero: meta.numero,
        tc: meta.tc,
        transportUSDActivo: transportUSDTotal,
        tipoCotizacion,
        aprobacion: aprobacionSnapshot(),
        empresa,
        moneda,
      });
    } finally {
      emitiendoRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col" data-empresa={empresa}>
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
        usaTC={info.usaTC}
        moneda={moneda}
        empresaNombre={info.corto}
        empresaAccent={info.accent}
        totalRevenue={trailerTotals.totalRevenueUSD}
        totalCost={trailerTotals.totalCostUSD}
        utilidadGlobal={trailerTotals.utilidadGlobal}
        kgNetoTotal={trailerTotals.kgNetoTotal}
      />

      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Sidebar: en USA bloques de trailer; en México panel de transporte simple */}
        <aside className="col-span-3 max-h-[calc(100vh-180px)] overflow-y-auto pr-1 space-y-3">
          {!info.multiTrailer && (
            <div className="card p-3">
              <p className="text-2xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Transporte
              </p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-2xs cursor-pointer">
                  <input
                    type="radio"
                    name="transporteMX"
                    checked={transporteMX === 'pickup'}
                    onChange={() => handleTransporteMX('pickup')}
                  />
                  <span>Cliente recoge en almacén <span className="text-text-muted">(sin costo)</span></span>
                </label>
                <label className="flex items-center gap-2 text-2xs cursor-pointer">
                  <input
                    type="radio"
                    name="transporteMX"
                    checked={transporteMX === 'castores'}
                    onChange={() => handleTransporteMX('castores')}
                  />
                  <span>Envío por Castores</span>
                </label>
              </div>
              {transporteMX === 'castores' && (
                <div className="mt-2">
                  <label className="label">Flete Castores (MXN)</label>
                  <input
                    type="number" step="100" min="0"
                    value={trailers[0]?.transport_usd || ''}
                    onChange={(e) =>
                      updateTrailer(trailers[0]?.id ?? 1, { transport_usd: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0"
                    className="input"
                  />
                </div>
              )}
            </div>
          )}

          {/* Datos de la cotización México (van al PDF de Extruidos) */}
          {!info.multiTrailer && (
            <div className="card p-3 space-y-2">
              <p className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
                Datos de la cotización
              </p>
              <div>
                <label className="label">Correo del cliente</label>
                <input
                  type="email"
                  value={correoCliente}
                  onChange={(e) => setCorreoCliente(e.target.value)}
                  placeholder="correo@cliente.com"
                  className="input input-text"
                />
              </div>
              <div>
                <label className="label">Teléfono del cliente</label>
                <input
                  type="text"
                  value={telefonoCliente}
                  onChange={(e) => setTelefonoCliente(e.target.value)}
                  placeholder="444 491 6667"
                  className="input input-text"
                />
              </div>
              <div>
                <label className="label">Forma de pago</label>
                <select
                  value={formaPago}
                  onChange={(e) => setFormaPago(e.target.value as FormaPago)}
                  className="input input-text"
                >
                  <option value="contado">Contado</option>
                  <option value="credito30">Crédito 30 días</option>
                  <option value="credito60">Crédito 60 días</option>
                  <option value="credito90">Crédito 90 días</option>
                </select>
              </div>
              <div>
                <label className="label">Anticipo (MXN)</label>
                <input
                  type="number" step="100" min="0"
                  value={anticipo || ''}
                  onChange={(e) => setAnticipo(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="input"
                />
              </div>
            </div>
          )}

          <TrailerStack
            trailers={trailers}
            items={items}
            results={results}
            perTrailer={trailerTotals.perTrailer}
            activeId={activeId}
            simpleMode={!info.multiTrailer}
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
          {/* Barra compacta de contexto: empresa + tipo de cotización en UNA
              sola fila. Antes eran dos tarjetas altas apiladas que empujaban la
              captura del pedido hacia abajo (la mesa de diseño: "config antes de
              capturar, sin punto focal"). Las descripciones largas viven ahora
              en tooltips para devolverle el espacio al formulario, que es la
              tarea principal. */}
          <div
            className="card px-3 py-2 mb-4 flex flex-wrap items-center gap-x-5 gap-y-2"
            style={{ borderColor: `${info.accent}66` }}
          >
            {/* Empresa / mercado */}
            <div className="flex items-center gap-2">
              <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                Empresa
              </span>
              <div className="inline-flex rounded-md border border-border-subtle overflow-hidden">
                {([
                  ['bionovapack', 'BioNovaPack · USA'],
                  ['extruidos', 'Extruidos · México'],
                ] as [Empresa, string][]).map(([e, label]) => (
                  <button
                    key={e}
                    onClick={() => handleEmpresaChange(e)}
                    title={
                      e === 'extruidos'
                        ? 'México · todo en pesos (MXN), sin tipo de cambio.'
                        : 'EUA · todo en dólares (USD), con tipo de cambio.'
                    }
                    className="px-3 py-1.5 text-2xs font-semibold transition-colors"
                    style={
                      empresa === e
                        ? { backgroundColor: `${info.accent}26`, color: info.accent }
                        : { color: 'var(--color-text-secondary)' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span
                className="text-2xs font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${info.accent}22`, color: info.accent }}
              >
                {moneda}
              </span>
            </div>

            <div className="h-5 w-px bg-border-subtle hidden sm:block" />

            {/* Tipo de cotización (descripciones en tooltip) */}
            <div className="flex items-center gap-2">
              <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                Cotización
              </span>
              <div className="inline-flex rounded-md border border-border-subtle overflow-hidden">
                {([
                  ['directa', 'Directa', 'Se fabrica EXACTAMENTE lo que pide el cliente. Sin optimización.'],
                  ['optimizada', 'Optimizada', 'El sistema propone una alternativa más rentable (reducir largo + compensar cono).'],
                  ['optimizada_revision', 'Optimizada + revisión', 'Optimizada, pero un cambio de spec crítica (reducción > 35%) requiere aprobación.'],
                ] as [TipoCotizacion, string, string][]).map(([modo, label, hint]) => (
                  <button
                    key={modo}
                    onClick={() => handleModeChange(modo)}
                    title={hint}
                    className={`px-3 py-1.5 text-2xs font-semibold transition-colors ${
                      tipoCotizacion === modo
                        ? 'bg-bnp-green/20 text-bnp-green'
                        : 'bg-bg-surface text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recordatorio corto del modo activo; se oculta en pantallas chicas */}
            <span className="text-2xs text-text-muted flex-1 min-w-[140px] text-right hidden lg:block">
              {tipoCotizacion === 'directa'
                ? 'Tal cual lo pide el cliente.'
                : tipoCotizacion === 'optimizada'
                ? 'Propone una versión más rentable.'
                : 'Optimizada; reducción >35% pide aprobación.'}
            </span>
          </div>

          {/* Panel de aprobación (v1.22): aparece solo cuando el modo es
              'optimizada + revisión' Y hay una reducción > 35% en alguna
              línea. Captura ligera: nombre + casilla + timestamp. Bloquea la
              emisión de PDFs hasta que se confirme. */}
          {requiereAprobacion && (
            <div className="card p-3 mb-4 border-bnp-red/40 bg-bnp-red/5">
              <div className="flex items-start gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-bnp-red flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-2xs font-semibold text-bnp-red uppercase tracking-wider">
                    Requiere aprobación comercial/técnica
                  </p>
                  <p className="text-2xs text-text-secondary mt-0.5">
                    Esta cotización reduce el material más de 35%. Captura quién lo aprueba
                    antes de generar la cotización o la PO.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pl-6">
                <input
                  type="text"
                  value={aprobadoPor}
                  onChange={(e) => {
                    setAprobadoPor(e.target.value);
                    setAprobadoEn(null); // cambiar el nombre re-exige confirmar
                  }}
                  placeholder="Nombre de quien aprueba"
                  className="input input-text max-w-xs"
                />
                <label className="inline-flex items-center gap-2 text-2xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!aprobadoEn}
                    disabled={!aprobadoPor.trim()}
                    onChange={(e) => setAprobadoEn(e.target.checked ? new Date().toISOString() : null)}
                  />
                  Apruebo esta cotización
                </label>
                {aprobadoEn && (
                  <span className="text-2xs text-bnp-green">
                    ✓ Aprobada por {aprobadoPor.trim()} · {new Date(aprobadoEn).toLocaleString('es-MX')}
                  </span>
                )}
              </div>
            </div>
          )}

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
              esMexico={empresa === 'extruidos'}
              onChange={updateActive}
            />
          ) : (
            <TabSugerencia
              item={activeItem}
              result={activeResult}
              directResult={activeDirectResult}
              tipoCotizacion={tipoCotizacion}
              esMexico={empresa === 'extruidos'}
              tc={tcCalc}
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
