'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileSpreadsheet, Database, Layers, Box, Download, Sparkles } from 'lucide-react';
import UploadZone from './components/UploadZone';
import AdminGuard from '../components/AdminGuard';
import { invalidatePriceData } from '@/lib/dataStore';

// Pagina central de upload de los 3 archivos que arman la base de precios
// del cotizador. Diego sube cada uno y el server lo parsea + persiste.
export default function PreciosPage() {
  const [uploadCount, setUploadCount] = useState(0);

  const handleSuccess = () => {
    invalidatePriceData(); // limpiar cache para que el cotizador jale frescos
    setUploadCount((c) => c + 1);
  };

  return (
    <AdminGuard>
    <div className="min-h-screen bg-bg p-6">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/cotizador"
          className="text-2xs text-text-muted hover:text-text-primary inline-flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="w-3 h-3" /> Volver al cotizador
        </Link>

        <div className="card p-6 mb-5">
          <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-bnp-green" />
            Carga de archivos de precios
          </h1>
          <p className="text-sm text-text-secondary">
            Sube los 3 archivos que Diego envía. El cotizador los usa
            automáticamente para sugerir conos, calcular costos y precios.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-4 text-2xs">
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-bnp-green mt-1" />
              <span className="text-text-muted">
                <span className="text-text-primary font-semibold">EDSA Extruidos</span> →
                precios base de stretch films por cono y peso total
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-bnp-cyan mt-1" />
              <span className="text-text-muted">
                <span className="text-text-primary font-semibold">Color</span> →
                precios para productos con color, R-V, intenso, master
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-bnp-purple mt-1" />
              <span className="text-text-muted">
                <span className="text-text-primary font-semibold">Tarima</span> →
                catálogo de SKUs históricos + reglas de rollos por tarima
              </span>
            </div>
          </div>
        </div>

        {uploadCount > 0 && (
          <div className="card p-4 mb-5 border-bnp-green/40">
            <p className="text-sm">
              <span className="text-bnp-green font-semibold">✓ {uploadCount} archivo{uploadCount > 1 ? 's' : ''} cargado{uploadCount > 1 ? 's' : ''}</span>
              <span className="text-text-muted ml-2">
                — el cotizador ya está usando los datos nuevos
              </span>
            </p>
          </div>
        )}

        {/* === Banner prominente: templates limpios para Diego === */}
        <div className="card p-5 mb-5 border-bnp-cyan/40 bg-bnp-cyan/5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-bnp-cyan/15 text-bnp-cyan">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold mb-1">
                ¿Primera vez que Diego sube precios desde aquí?
              </h3>
              <p className="text-xs text-text-secondary mb-3">
                Diego puede usar sus Excels actuales (el sistema los acepta auto-detectando el formato) <strong>O</strong> bajar estos 3 templates limpios con UNA sola hoja por archivo. Más fácil de mantener:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <a
                  href="/templates/template_precios_EDSA.xlsx"
                  download
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-bnp-green/40 bg-bnp-green/10 text-bnp-green hover:bg-bnp-green/20 transition-colors text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Template EDSA
                </a>
                <a
                  href="/templates/template_precios_color.xlsx"
                  download
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-bnp-cyan/40 bg-bnp-cyan/10 text-bnp-cyan hover:bg-bnp-cyan/20 transition-colors text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Template Color
                </a>
                <a
                  href="/templates/template_tarima.xlsx"
                  download
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-bnp-purple/40 bg-bnp-purple/10 text-bnp-purple hover:bg-bnp-purple/20 transition-colors text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Template Tarima
                </a>
              </div>
              <p className="text-2xs text-text-muted mt-2">
                Cada template trae README con instrucciones + filas de ejemplo pre-cargadas con datos reales para entender el formato.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <UploadZone
            kind="edsa"
            title="EDSA / Extruidos"
            description="Precios de producto Manual, Semi/Auto, Pre-estirado"
            expectedSheets="Hojas: Cono de 0.350, 0.400, ... + Semi/Auto"
            accentColor="#5BAA47"
            icon={<Database className="w-5 h-5" />}
            onUploadSuccess={handleSuccess}
          />

          <UploadZone
            kind="color"
            title="Color / R-V / Intenso"
            description="Precios para producto terminado con color"
            expectedSheets="Hojas: Color 300, R-V 400, Color Auto X.X, etc."
            accentColor="#009FE3"
            icon={<Layers className="w-5 h-5" />}
            onUploadSuccess={handleSuccess}
          />

          <UploadZone
            kind="tarima"
            title="Cantidad por Tarima"
            description="Catálogo SKU histórico + reglas de rollos/tarima"
            expectedSheets="Hojas: General, Filtros (catálogo)"
            accentColor="#6B2C91"
            icon={<Box className="w-5 h-5" />}
            onUploadSuccess={handleSuccess}
          />
        </div>

        <div className="card p-4 mt-5 bg-bg-surface">
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-2">
            Notas para Diego
          </h4>
          <ul className="text-2xs text-text-secondary space-y-1.5">
            <li>
              • Si subes un archivo nuevo del mismo tipo, las versiones anteriores se
              marcan como obsoletas pero <span className="text-text-primary">se mantienen en historial</span>
            </li>
            <li>
              • El parser tolera el formato actual de tus Excels — no necesitas cambiar
              nada de cómo los armas
            </li>
            <li>
              • Si aparecen warnings, revisa las primeras filas que se mostrarán abajo —
              probablemente son hojas extra que el parser ignoró
            </li>
            <li>
              • Los precios se aplican <span className="text-text-primary">inmediatamente</span> al cotizador
              de los vendedores
            </li>
          </ul>
        </div>
      </div>
    </div>
    </AdminGuard>
  );
}
