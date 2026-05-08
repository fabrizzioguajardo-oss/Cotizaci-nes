'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Database, Palette, Droplet, Package2, Box, Scissors, TrendingUp, FileSpreadsheet } from 'lucide-react';
import CatalogSection from './components/CatalogSection';
import BasePricesView from './components/BasePricesView';
import type { CostCategory } from '@/types';

interface TabDef {
  key: CostCategory | 'base';
  label: string;
  icon: React.ReactNode;
  color: string;
}

const TABS: TabDef[] = [
  { key: 'base',     label: 'Base EDSA',    icon: <FileSpreadsheet className="w-3.5 h-3.5" />, color: '#5BAA47' },
  { key: 'master',   label: 'Master color', icon: <Palette className="w-3.5 h-3.5" />,         color: '#6B2C91' },
  { key: 'intenso',  label: 'Intenso',      icon: <Droplet className="w-3.5 h-3.5" />,         color: '#009FE3' },
  { key: 'aditivo',  label: 'Aditivos',     icon: <Droplet className="w-3.5 h-3.5" />,         color: '#F59E0B' },
  { key: 'caja',     label: 'Caja blanca',  icon: <Box className="w-3.5 h-3.5" />,             color: '#5BAA47' },
  { key: 'banding',  label: 'Banding',      icon: <Package2 className="w-3.5 h-3.5" />,        color: '#8945B2' },
  { key: 'refilado', label: 'Refilado',     icon: <Scissors className="w-3.5 h-3.5" />,        color: '#EF4444' },
  { key: 'aumento',  label: 'Aumentos',     icon: <TrendingUp className="w-3.5 h-3.5" />,      color: '#F59E0B' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabDef['key']>('base');

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border bg-bg-elevated">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <Link
              href="/cotizador"
              className="text-2xs text-text-muted hover:text-text-primary inline-flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="w-3 h-3" /> Volver al cotizador
            </Link>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Database className="w-5 h-5 text-bnp-green" />
              Admin de costos
            </h1>
            <p className="text-2xs text-text-muted mt-0.5">
              Catálogo central de adders externos (master, intenso, aditivos, cajas, banding, refilado, aumentos).
              Aquí Diego o el admin centralizan todo lo que viene de WhatsApp / correo / Excels sueltos.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-t border-border-subtle overflow-x-auto">
          <div className="flex">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`tab whitespace-nowrap ${activeTab === t.key ? 'tab-active' : ''}`}
                style={activeTab === t.key ? { borderBottomColor: t.color, color: '#E6EDF3' } : {}}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t.icon}
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-4">
        {activeTab === 'base' && <BasePricesView />}

        {activeTab === 'master' && (
          <CatalogSection
            category="master"
            title="Master color"
            description="Costo del masterbatch por color. Default histórico ~1.5 MXN/kg para colores estándar."
            unitLabel="MXN/kg"
            nameSuggestions={['Orange', 'Purple', 'White', 'Blue', 'Red', 'Green', 'Yellow', 'Black']}
          />
        )}

        {activeTab === 'intenso' && (
          <CatalogSection
            category="intenso"
            title="Intenso (pigmento concentrado)"
            description="Para colores que requieren pigmento adicional sobre el master."
            unitLabel="MXN/kg"
            nameSuggestions={['Negro intenso', 'Naranja intenso', 'Azul intenso']}
          />
        )}

        {activeTab === 'aditivo' && (
          <CatalogSection
            category="aditivo"
            title="Aditivos (UV, VCI, antibloqueo)"
            description="Aditivos especiales por pedido. UV típico para machine film en exteriores (~3.9 MXN/kg)."
            unitLabel="MXN/kg"
            nameSuggestions={['UV 12 month', 'UV 6 month', 'VCI', 'Antibloqueo', 'Antiestatico']}
          />
        )}

        {activeTab === 'caja' && (
          <CatalogSection
            category="caja"
            title="Caja blanca (cardboard)"
            description="Costo de la caja por unidad. El sistema convierte automáticamente a MXN/kg en función del PN del rollo y rollos por caja."
            unitLabel="MXN/caja"
            inputFields={[
              { key: 'caja_mxn', label: 'MXN por caja', type: 'number', step: '0.01', placeholder: '14.43' },
              { key: 'kg_caja', label: 'Kg por caja', type: 'number', step: '0.1', placeholder: '2.1' },
              { key: 'rollos_caja', label: 'Rollos / caja', type: 'number', step: '1', placeholder: '4' },
            ]}
            // Para guardado de referencia: asume 2.8kg de PN como rollo tipico para mostrar el MXN/kg estimado
            computeRate={(inputs) => {
              const caja_mxn = inputs.caja_mxn ?? 0;
              const rollos_caja = inputs.rollos_caja ?? 4;
              const pn_ref = 2.8; // rollo de referencia para preview
              return rollos_caja > 0 ? caja_mxn / (pn_ref * rollos_caja) : 0;
            }}
            computeRateNote="MXN/kg estimado = MXN_caja / (PN_rollo × rollos_caja). Recalculado en tiempo real al usarse en una cotización con el PN real del item."
            nameSuggestions={['Caja 80 cases 2.1kg', 'Caja 64 cases 3.3kg', 'Caja machine film 1kg']}
          />
        )}

        {activeTab === 'banding' && (
          <CatalogSection
            category="banding"
            title="Banding / Plastic"
            description="Marca de plástico al final del cono de cartón. Cliente solicita en pedidos especiales."
            unitLabel="MXN/kg"
            nameSuggestions={['Banding plastic estandar', 'Banding etiquetado']}
          />
        )}

        {activeTab === 'refilado' && (
          <CatalogSection
            category="refilado"
            title="Refilado (slitting / rewinding)"
            description="Costo de procesamiento adicional cuando se requiere recortar un rollo más ancho. Típico 1.3–3.0 MXN/kg."
            unitLabel="MXN/kg"
            nameSuggestions={['Refilado estandar', 'Refilado a 14in', 'Refilado a 18in']}
          />
        )}

        {activeTab === 'aumento' && (
          <CatalogSection
            category="aumento"
            title="Aumentos de planta"
            description="Escalones de costo aplicados por la planta (1ero, 2do, 3ro). Típico 0.8 MXN/kg cada uno."
            unitLabel="MXN/kg"
            nameSuggestions={['Aumento 1ero', 'Aumento 2do', 'Aumento 3ro']}
          />
        )}
      </main>
    </div>
  );
}
