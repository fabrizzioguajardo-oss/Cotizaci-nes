'use client';

import { useEffect, useState } from 'react';
import type { CostCatalogEntry, CostCategory } from '@/types';
import { loadCatalog } from '@/lib/catalogClient';
import { ChevronDown, Database } from 'lucide-react';

interface Props {
  category: CostCategory;
  onPick: (entry: CostCatalogEntry) => void;
  // Para caja: el PN_real para hacer el calculo on-the-fly
  pnRealKg?: number;
  rollosCaja?: number;
}

// Dropdown que jala entradas vigentes del catalogo de la categoria.
// Aparece como un boton pequeno al lado del input numerico correspondiente.
export default function CatalogPicker({
  category,
  onPick,
  pnRealKg,
  rollosCaja,
}: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CostCatalogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    loadCatalog(category).then((data) => {
      setEntries(data);
      setLoaded(true);
    });
  }, [open, loaded, category]);

  const handleSelect = (entry: CostCatalogEntry) => {
    // Para caja blanca: recalcular MXN/kg con el PN_real del item activo
    let finalEntry = entry;
    if (category === 'caja' && entry.inputs && pnRealKg && pnRealKg > 0 && rollosCaja && rollosCaja > 0) {
      const cajaMxn = Number(entry.inputs.caja_mxn ?? 0);
      const rollosFromCatalog = Number(entry.inputs.rollos_caja ?? rollosCaja);
      const recalc = cajaMxn / (pnRealKg * rollosFromCatalog);
      finalEntry = { ...entry, precio_mxn_kg: recalc };
    }
    onPick(finalEntry);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-2xs text-text-muted hover:text-bnp-green inline-flex items-center gap-1"
        title="Cargar del catálogo"
      >
        <Database className="w-3 h-3" />
        catálogo
        <ChevronDown className="w-2.5 h-2.5" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 w-72 bg-bg-elevated border border-border rounded-md shadow-popover z-20 max-h-72 overflow-y-auto animate-modal-in">
            {!loaded ? (
              <div className="p-3 space-y-2" aria-hidden>
                <div className="skeleton h-7 w-full" />
                <div className="skeleton h-7 w-full" />
                <div className="skeleton h-7 w-3/4" />
              </div>
            ) : entries.length === 0 ? (
              <p className="p-3 text-xs text-text-muted text-center">
                Sin entradas vigentes — agrega en /admin
              </p>
            ) : (
              <ul>
                {entries.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(e)}
                      className="w-full text-left px-3 py-2 hover:bg-bg-hover border-b border-border-subtle last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{e.name}</span>
                        <span className="mono text-2xs font-semibold text-bnp-green">
                          {e.precio_mxn_kg.toFixed(3)}
                        </span>
                      </div>
                      {e.source_note && (
                        <p className="text-2xs text-text-muted truncate mt-0.5">
                          {e.source_note}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
