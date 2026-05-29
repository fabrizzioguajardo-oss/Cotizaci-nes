'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';
import { Package, Mail, Loader2, AlertCircle } from 'lucide-react';
import { APP_VERSION_FULL, APP_ORG } from '@/lib/version';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get('next') || '/cotizador';

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
      setError(error.message);
      return;
    }
    router.push(`/auth/check-email?email=${encodeURIComponent(email.trim())}`);
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
            Te mandamos un enlace mágico a tu correo. Sin contraseñas.
          </p>

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
