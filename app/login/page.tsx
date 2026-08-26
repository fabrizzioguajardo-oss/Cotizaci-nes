'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';
import { Package, Mail, Loader2, AlertCircle } from 'lucide-react';
import { APP_VERSION_FULL, APP_ORG } from '@/lib/version';

// Traduce el error técnico del magic link (que viene en ?error= desde
// /auth/callback) a una explicación accionable en español. Antes el login
// IGNORABA este parámetro: el enlace fallaba y el usuario solo veía otra vez
// el campo de correo, sin pista alguna (loop mudo).
function describeLinkError(raw: string): { titulo: string; detalle: string } {
  const lower = raw.toLowerCase();
  if (lower.includes('verifier') || lower.includes('challenge')) {
    return {
      titulo: 'El enlace se abrió en otro navegador',
      detalle:
        'Por seguridad, el enlace solo funciona en el mismo navegador donde pediste el correo. ' +
        'Pide el enlace desde este navegador y ábrelo aquí mismo (si tu correo lo abre en otra app, ' +
        'copia el enlace y pégalo en esta ventana).',
    };
  }
  if (lower.includes('expired') || lower.includes('invalid') || lower.includes('otp')) {
    return {
      titulo: 'El enlace ya se usó o expiró',
      detalle:
        'Cada enlace sirve UNA sola vez. A veces el filtro del correo corporativo lo "abre" antes que tú ' +
        'y lo gasta. Pide un enlace nuevo; si vuelve a pasar, avísale a Fabrizzio.',
    };
  }
  if (lower === 'missing_code') {
    return {
      titulo: 'El enlace llegó incompleto',
      detalle:
        'Se abrió la página de acceso sin el código del enlace. Copia y pega el enlace completo del correo, ' +
        'o pide uno nuevo desde aquí.',
    };
  }
  return { titulo: 'No se pudo iniciar sesión con el enlace', detalle: raw };
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get('next') || '/cotizador';
  // Error del magic link propagado por /auth/callback
  const linkErrorRaw = params.get('error');
  const linkError = linkErrorRaw ? describeLinkError(linkErrorRaw) : null;

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError('Supabase no está configurado. Avísale a Fabrizzio.');
      return;
    }
    if (!email.trim()) {
      setError('Ingresa tu email');
      return;
    }

    setLoading(true);
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
        : undefined;

    const { error } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);

    if (error) {
      // Traducir el límite de correos del plan de Supabase a algo accionable
      setError(
        /rate limit/i.test(error.message)
          ? 'Se alcanzó el límite de correos por hora del sistema. Espera ~1 hora y vuelve a intentar (los intentos fallidos también cuentan).'
          : error.message,
      );
      return;
    }
    router.push(
      `/auth/check-email?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(nextPath)}`,
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-bnp-green/10 border border-bnp-green/25 flex items-center justify-center">
            <Package className="w-6 h-6 text-bnp-green" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              <span className="text-bnp-green">SICE</span>{' '}
              <span className="text-text-muted">·</span>{' '}
              <span className="text-text-primary">Cotizador</span>
            </h1>
            <p className="text-2xs text-text-muted">{APP_ORG}</p>
          </div>
        </div>

        <div className="card p-7">
          <h2 className="text-base font-semibold mb-1">Inicia sesión</h2>
          <p className="text-sm text-text-secondary mb-5">
            Te mandamos un código de acceso a tu correo. Sin contraseñas.
          </p>

          {linkError && (
            <div className="flex items-start gap-2 text-2xs border border-bnp-red/30 bg-bnp-red/10 rounded p-2.5 mb-4">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-bnp-red" />
              <div>
                <p className="font-semibold text-bnp-red">{linkError.titulo}</p>
                <p className="text-text-secondary mt-0.5">{linkError.detalle}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo corporativo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@bionovapack.com"
                className="input input-text"
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-2xs text-bnp-red border border-bnp-red/30 bg-bnp-red/10 rounded p-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="btn-primary w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando enlace…
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Enviarme enlace de acceso
                </>
              )}
            </button>
          </form>

          <p className="text-2xs text-text-muted mt-5 text-center">
            ¿No tienes acceso? Pídele a Fabrizzio que te agregue.
          </p>
        </div>

        <p className="text-2xs text-text-muted text-center mt-4">
          {APP_VERSION_FULL} · Cotizador interno BioNovaPack
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <LoginInner />
    </Suspense>
  );
}
