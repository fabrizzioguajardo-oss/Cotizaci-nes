'use client';

import { useState, useRef } from 'react';
import { parseExcelFile, type ParsedPrecio } from '@/lib/excelParser';
import { fmtNum } from '@/lib/format';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PreciosPage() {
  const [parsed, setParsed] = useState<ParsedPrecio[] | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setFilename(file.name);
    setUploadResult(null);
    const buffer = await file.arrayBuffer();
    try {
      const rows = parseExcelFile(buffer);
      setParsed(rows);
    } catch (err) {
      setParsed([]);
      console.error(err);
    }
  }

  async function handleConfirmUpload() {
    if (!parsed || parsed.length === 0) return;
    setUploading(true);
    try {
      const res = await fetch('/api/precios/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ precios: parsed, archivo_origen: filename }),
      });
      const data = await res.json();
      setUploadResult(data.message || `${data.inserted ?? 0} precios cargados`);
    } catch (err) {
      setUploadResult('Error al cargar precios. Verifica configuración de Supabase.');
    } finally {
      setUploading(false);
    }
  }

  const validRows = parsed?.filter((p) => !p.warning) ?? [];
  const warningRows = parsed?.filter((p) => p.warning) ?? [];

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/cotizador" className="text-2xs text-text-muted hover:text-text-primary inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="w-3 h-3" /> Volver al cotizador
        </Link>

        <div className="card p-6 mb-4">
          <h1 className="text-xl font-semibold mb-1">Precios EDSA / Extruidos</h1>
          <p className="text-sm text-text-secondary">
            Carga el Excel que envía Diego Cortés con los precios actualizados.
            Soporta los archivos <span className="mono text-text-primary">Precios_de_producto_EDSA</span> y
            <span className="mono text-text-primary"> Precios_Color</span>.
          </p>
        </div>

        {!parsed && (
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onDragOver={(e) => e.preventDefault()}
            className="card p-12 border-2 border-dashed border-border hover:border-bnp-green/60 transition-colors cursor-pointer text-center"
          >
            <Upload className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-base font-semibold mb-1">Arrastra el Excel aquí</p>
            <p className="text-sm text-text-muted">o haz clic para seleccionar archivo</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.xlsm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="hidden"
            />
          </div>
        )}

        {parsed && (
          <>
            <div className="card p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-bnp-green" />
                <div>
                  <p className="text-sm font-semibold">{filename}</p>
                  <p className="text-2xs text-text-muted">
                    {validRows.length} filas válidas · {warningRows.length} con advertencia
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setParsed(null);
                    setFilename('');
                    setUploadResult(null);
                  }}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmUpload}
                  disabled={uploading || validRows.length === 0}
                  className="btn-primary text-xs"
                >
                  {uploading ? 'Cargando...' : `Confirmar carga (${validRows.length})`}
                </button>
              </div>
            </div>

            {uploadResult && (
              <div className="card p-4 mb-4 border-bnp-green/40">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-bnp-green" />
                  <p className="text-sm font-semibold text-bnp-green">{uploadResult}</p>
                </div>
              </div>
            )}

            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-surface border-b border-border-subtle">
                  <tr className="text-2xs text-text-secondary uppercase tracking-wider">
                    <th className="px-3 py-2 text-left">Resina</th>
                    <th className="px-3 py-2 text-left">Color</th>
                    <th className="px-3 py-2 text-right">Ancho (in)</th>
                    <th className="px-3 py-2 text-right">Calibre (GA)</th>
                    <th className="px-3 py-2 text-right">PN (kg)</th>
                    <th className="px-3 py-2 text-right">Cono (kg)</th>
                    <th className="px-3 py-2 text-right">Precio MXN/kg</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="mono">
                  {parsed.map((p, i) => (
                    <tr key={i} className="border-b border-border-subtle hover:bg-bg-hover">
                      <td className="px-3 py-2">{p.tipo_resina}</td>
                      <td className="px-3 py-2">{p.tipo_color || '—'}</td>
                      <td className="px-3 py-2 text-right">{p.ancho_in ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{p.calibre_ga ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{p.peso_neto_kg !== null ? fmtNum(p.peso_neto_kg, 3) : '—'}</td>
                      <td className="px-3 py-2 text-right">{p.cono_kg !== null ? fmtNum(p.cono_kg, 3) : '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtNum(p.precio_mxn_kg, 3)}</td>
                      <td className="px-3 py-2">
                        {p.warning ? (
                          <span className="inline-flex items-center gap-1 text-bnp-amber text-2xs">
                            <AlertTriangle className="w-3 h-3" />
                            {p.warning}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-bnp-green text-2xs">
                            <CheckCircle className="w-3 h-3" />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
