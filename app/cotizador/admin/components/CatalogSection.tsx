'use client';

import { useEffect, useState } from 'react';
import type { CostCatalogEntry, CostCategory, CostSource } from '@/types';
import { loadCatalog, saveEntry, deleteEntry } from '@/lib/catalogClient';
import { fmtNum } from '@/lib/format';
import { Plus, Trash2, MessageCircle, Mail, FileSpreadsheet, Pencil } from 'lucide-react';
import FreshnessBadge from '@/app/cotizador/components/FreshnessBadge';

interface FieldDef {
  key: string;        // key dentro de inputs JSON
  label: string;
  type: 'number' | 'text';
  placeholder?: string;
  step?: string;
}

interface Props {
  category: CostCategory;
  title: string;
  description: string;
  // Si la categoria tiene inputs estructurados (ej. caja blanca), se definen aqui.
  // El precio_mxn_kg se calcula desde estos inputs via la formula provista.
  inputFields?: FieldDef[];
  computeRate?: (inputs: Record<string, number>) => number;
  computeRateNote?: string; // descripcion humana de la formula
  // Sugerencia de nombres comunes (autocomplete)
  nameSuggestions?: string[];
  // Default unit label
  unitLabel?: string; // 'MXN/kg' por default
}

const sourceIcon = {
  whatsapp: <MessageCircle className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
  excel: <FileSpreadsheet className="w-3 h-3" />,
  manual: <Pencil className="w-3 h-3" />,
};

const sourceLabel = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  excel: 'Excel',
  manual: 'Manual',
};

export default function CatalogSection({
  category,
  title,
  description,
  inputFields,
  computeRate,
  computeRateNote,
  nameSuggestions = [],
  unitLabel = 'MXN/kg',
}: Props) {
  const [entries, setEntries] = useState<CostCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [precio, setPrecio] = useState<number | ''>('');
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [source, setSource] = useState<CostSource>('manual');
  const [sourceNote, setSourceNote] = useState('');

  const refresh = async () => {
    setLoading(true);
    const data = await loadCatalog(category);
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [category]);

  // Si hay computeRate, recalcular automaticamente cuando cambien los inputs
  useEffect(() => {
    if (computeRate && inputFields) {
      const allFilled = inputFields.every((f) => Number.isFinite(inputs[f.key]) && inputs[f.key] > 0);
      if (allFilled) {
        setPrecio(parseFloat(computeRate(inputs).toFixed(4)));
      }
    }
  }, [inputs, computeRate, inputFields]);

  const resetForm = () => {
    setName('');
    setPrecio('');
    setInputs({});
    setSource('manual');
    setSourceNote('');
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!name.trim() || !Number.isFinite(precio) || (precio as number) <= 0) {
      alert('Nombre y precio son requeridos');
      return;
    }
    await saveEntry({
      category,
      name: name.trim(),
      precio_mxn_kg: precio as number,
      inputs: inputFields ? inputs : null,
      source,
      source_note: sourceNote.trim() || null,
      vigente: true,
      fecha_vigencia: new Date().toISOString().slice(0, 10),
      subido_por: null,
    });
    await refresh();
    resetForm();
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm('¿Marcar como obsoleta?')) return;
    await deleteEntry(id);
    await refresh();
  };

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-2xs text-text-muted mt-0.5">{description}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva entrada
        </button>
      </div>

      {showForm && (
        <div className="bg-bg-surface p-4 border-b border-border-subtle">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4">
              <label className="label">Nombre / identificador</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                list={`names-${category}`}
                placeholder={nameSuggestions[0] || 'ej. Orange'}
                className="input input-text"
              />
              {nameSuggestions.length > 0 && (
                <datalist id={`names-${category}`}>
                  {nameSuggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
            </div>

            {inputFields && inputFields.length > 0 ? (
              <>
                {inputFields.map((f) => (
                  <div key={f.key} className="col-span-2">
                    <label className="label">{f.label}</label>
                    <input
                      type={f.type}
                      step={f.step ?? '0.01'}
                      value={inputs[f.key] ?? ''}
                      onChange={(e) =>
                        setInputs((p) => ({
                          ...p,
                          [f.key]: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder={f.placeholder}
                      className="input"
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="label">{unitLabel} (calculado)</label>
                  <input
                    type="number" step="0.0001"
                    value={precio}
                    onChange={(e) => setPrecio(parseFloat(e.target.value) || 0)}
                    className="input input-green"
                  />
                </div>
              </>
            ) : (
              <div className="col-span-3">
                <label className="label">{unitLabel}</label>
                <input
                  type="number" step="0.01"
                  value={precio}
                  onChange={(e) => setPrecio(parseFloat(e.target.value) || 0)}
                  className="input input-green"
                />
              </div>
            )}

            <div className="col-span-2">
              <label className="label">Fuente</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as CostSource)}
                className="input input-text"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="excel">Excel</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <div className="col-span-12">
              <label className="label">Nota / referencia (mensaje literal o link)</label>
              <input
                type="text"
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
                placeholder="ej. WhatsApp Diego 5 May 2026: 'caja 4.87 80 2.1kgs'"
                className="input input-text"
              />
            </div>
          </div>

          {computeRateNote && (
            <p className="text-2xs text-text-muted mt-3 mono">
              Fórmula: <span className="text-bnp-cyan">{computeRateNote}</span>
            </p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={resetForm} className="btn-secondary text-xs">
              Cancelar
            </button>
            <button onClick={handleSave} className="btn-primary text-xs">
              Guardar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        {loading ? (
          <p className="p-6 text-center text-sm text-text-muted">Cargando...</p>
        ) : entries.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">
            Sin entradas. Agrega la primera con el botón de arriba.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle text-2xs text-text-secondary uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-right">{unitLabel}</th>
                {inputFields && <th className="px-3 py-2 text-left">Inputs</th>}
                <th className="px-3 py-2 text-left">Fuente</th>
                <th className="px-3 py-2 text-left">Nota</th>
                <th className="px-3 py-2 text-left">Última actualización</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border-subtle hover:bg-bg-hover">
                  <td className="px-3 py-2 font-medium">{e.name}</td>
                  <td className="px-3 py-2 text-right mono font-semibold text-bnp-green">
                    {fmtNum(e.precio_mxn_kg, 4)}
                  </td>
                  {inputFields && (
                    <td className="px-3 py-2 mono text-2xs text-text-muted">
                      {e.inputs
                        ? Object.entries(e.inputs)
                            .map(([k, v]) => `${k}=${v}`)
                            .join(' · ')
                        : '—'}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    {e.source && (
                      <span className="inline-flex items-center gap-1 text-2xs text-text-secondary">
                        {sourceIcon[e.source]}
                        {sourceLabel[e.source]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-2xs text-text-muted max-w-xs truncate" title={e.source_note ?? ''}>
                    {e.source_note ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <FreshnessBadge date={e.fecha_vigencia} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="p-1 rounded hover:bg-bnp-red/20 transition-colors"
                      title="Marcar como obsoleta"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-bnp-red" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
