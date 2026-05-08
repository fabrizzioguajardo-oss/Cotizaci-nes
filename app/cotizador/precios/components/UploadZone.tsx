'use client';

import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

export type UploadKind = 'edsa' | 'color' | 'tarima';

interface UploadResult {
  ok: boolean;
  kind: UploadKind;
  source_filename: string;
  stats: Record<string, number | string>;
  warnings_count: number;
  sample_warnings?: string[];
  persisted: boolean;
}

interface Props {
  kind: UploadKind;
  title: string;
  description: string;
  expectedSheets: string;
  accentColor: string; // hex
  icon: React.ReactNode;
  onUploadSuccess?: (result: UploadResult) => void;
}

// Una zona de upload por archivo (EDSA / Color / Tarima).
// Drag-drop o click. Al soltar el archivo lo manda al server, parsea,
// y muestra stats inmediatos.
export default function UploadZone({
  kind,
  title,
  description,
  expectedSheets,
  accentColor,
  icon,
  onUploadSuccess,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', kind);

      const res = await fetch('/api/data/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `Error ${res.status}`);
        return;
      }
      setResult(json as UploadResult);
      onUploadSuccess?.(json as UploadResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="card overflow-hidden"
      style={{ borderColor: result ? accentColor : undefined }}
    >
      <div
        className="px-4 py-3 border-b border-border-subtle flex items-center gap-3"
        style={{ backgroundColor: `${accentColor}15` }}
      >
        <div style={{ color: accentColor }}>{icon}</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-2xs text-text-muted">{description}</p>
        </div>
      </div>

      {!result && !uploading && (
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={`p-8 cursor-pointer text-center border-2 border-dashed m-3 rounded-md transition-colors ${
            dragOver ? 'bg-bg-hover' : 'border-border'
          }`}
          style={{ borderColor: dragOver ? accentColor : undefined }}
        >
          <Upload
            className="w-7 h-7 mx-auto mb-2"
            style={{ color: dragOver ? accentColor : '#6E7681' }}
          />
          <p className="text-sm font-medium mb-1">Arrastra el Excel aquí</p>
          <p className="text-2xs text-text-muted">o haz clic para seleccionar</p>
          <p className="text-2xs text-text-muted mt-3 mono">
            {expectedSheets}
          </p>
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

      {uploading && (
        <div className="p-8 text-center">
          <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2" style={{ color: accentColor }} />
          <p className="text-sm">Procesando archivo…</p>
          <p className="text-2xs text-text-muted mt-1">
            Parseando hojas y normalizando precios
          </p>
        </div>
      )}

      {result && (
        <div className="p-4">
          <div className="flex items-start gap-2 mb-3">
            <CheckCircle className="w-4 h-4 mt-0.5" style={{ color: accentColor }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{result.source_filename}</p>
              <p className="text-2xs text-text-muted truncate">
                {result.persisted ? '✓ Guardado en BD' : '⚠ Solo en memoria (Supabase no configurado)'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {Object.entries(result.stats).map(([k, v]) => (
              <div key={k} className="bg-bg-surface rounded p-2 text-center">
                <p className="text-2xs text-text-muted uppercase">{k.replace(/_/g, ' ')}</p>
                <p className="mono text-sm font-semibold">{String(v)}</p>
              </div>
            ))}
          </div>

          {result.warnings_count > 0 && result.sample_warnings && (
            <div className="bg-bnp-amber/10 border border-bnp-amber/30 rounded p-2 mb-3">
              <p className="text-2xs font-semibold text-bnp-amber mb-1 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {result.warnings_count} warnings
              </p>
              <ul className="text-2xs text-text-secondary space-y-0.5">
                {result.sample_warnings.slice(0, 3).map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setError(null);
            }}
            className="btn-secondary text-xs w-full"
          >
            Subir otro
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 border-t border-border-subtle">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-bnp-red mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-bnp-red">Error al cargar</p>
              <p className="text-2xs text-text-secondary mt-1">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                }}
                className="btn-secondary text-2xs mt-2"
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
