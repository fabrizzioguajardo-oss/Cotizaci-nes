'use client';

import { useState } from 'react';
import { User, AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  initialEmail: string;
  initialName?: string;             // si está editando un nombre que ya existe
  // 'onboarding' (primera vez, bloqueante) | 'edit' (cambio voluntario, cancelable)
  mode: 'onboarding' | 'edit';
  onSaved: (name: string) => void;
  onCancel?: () => void;            // solo aplica en mode='edit'
}

// Modal para capturar el nombre del vendedor que firma los PDFs.
//
// MODO 'onboarding': bloqueante. Se abre automáticamente al cargar el
// cotizador si `profile.name` está vacío (estado inicial del trigger
// handle_new_user — el magic link solo recibe email). NO se puede cerrar
// sin escribir un nombre. Esto garantiza que CERO PDFs salgan firmados
// con el email del usuario.
//
// MODO 'edit': cancelable. Se abre desde el botón "editar nombre" del
// TopBar para que el usuario corrija un error tipográfico.
export default function OnboardingNameModal({
  open,
  initialEmail,
  initialName = '',
  mode,
  onSaved,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr('Escribe tu nombre completo antes de continuar.');
      return;
    }
    if (trimmed.length > 200) {
      setErr('El nombre es demasiado largo (máximo 200 caracteres).');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || `Error ${res.status}`);
        setSaving(false);
        return;
      }
      onSaved(trimmed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error de red');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      // En modo onboarding NO se cierra al picar fuera. En modo edit sí.
      onClick={mode === 'edit' ? onCancel : undefined}
    >
      <div
        className="card max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-bnp-green/15 flex items-center justify-center text-bnp-green flex-shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">
              {mode === 'onboarding' ? 'Antes de empezar a cotizar' : 'Editar tu nombre'}
            </h2>
            <p className="text-2xs text-text-muted mt-0.5 break-all">{initialEmail}</p>
          </div>
        </div>

        {mode === 'onboarding' && (
          <div className="bg-bnp-amber/10 border border-bnp-amber/30 rounded-md p-3 mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-bnp-amber flex-shrink-0 mt-0.5" />
            <p className="text-2xs text-text-secondary leading-relaxed">
              Escribe tu <strong>nombre completo</strong>. Este nombre aparece
              como firma en cada <strong>cotización al cliente</strong> y en cada{' '}
              <strong>orden de compra a Extruidos</strong> que generes con el
              cotizador. Si lo escribes con error, los PDFs salen con ese error
              hasta que lo corrijas.
            </p>
          </div>
        )}

        <label className="label">Nombre completo</label>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !saving && name.trim()) handleSave();
          }}
          placeholder="Ej. Evers López Sánchez"
          className="input input-text"
          disabled={saving}
        />
        {err && (
          <p className="text-2xs text-bnp-red mt-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {err}
          </p>
        )}

        <div className="flex gap-2 mt-5">
          {mode === 'edit' && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="btn-primary flex-1"
          >
            {saving
              ? 'Guardando…'
              : mode === 'onboarding'
              ? 'Guardar y empezar a cotizar'
              : 'Guardar cambios'}
          </button>
        </div>

        {mode === 'onboarding' && (
          <p className="text-2xs text-text-muted mt-3 text-center">
            Después puedes editar tu nombre en cualquier momento desde la
            esquina superior derecha.
          </p>
        )}
      </div>
    </div>
  );
}
