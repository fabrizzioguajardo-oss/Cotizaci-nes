'use client';

// Pantalla post-envío del correo de acceso. Además de avisar que llegó un
// correo, ahora acepta el CÓDIGO de 6 dígitos ({{ .Token }} en el template de
// Supabase) y lo verifica con verifyOtp. Motivo: los enlaces mágicos fallaban
// en correos corporativos (@bionovapack.com) — el filtro de seguridad del
// correo "abre" el enlace antes que el usuario y lo gasta (un solo uso), y
// además el enlace solo funcionaba en el navegador que lo pidió (PKCE). El
// código tecleado no tiene ninguno de los dos problemas.

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, ArrowLeft, KeyRound, Loader2, AlertCircle } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase';

// Traduce errores comunes de verifyOtp a español accionable
function describeOtpError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('expired') || lower.includes('invalid')) {
    return 'Código incorrecto o vencido. Revisa que sea el del correo MÁS reciente y que no lleve espacios. Si ya pasó más de 1 hora, pide uno nuevo.';
  }
  if (lower.includes('rate limit')) {
    return 'Se alcanzó el límite de intentos por hora. Espera unos minutos e intenta de nuevo.';
  }
  return raw;
}

function Inner() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const next = params.get('next') || '/cotizador';

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError('Supabase no está configurado. Avísale a Fabrizzio.');
      return;
    }
    if (code.length !== 6) {
      setError('El código tiene 6 dígitos.');
      return;
    }
    setVerifying(true);
    const { error: otpError } = await sb.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'email',
    });
    if (otpError) {
      setVerifying(false);
      setError(describeOtpError(otpError.message));
      return;
    }
    // Sesión creada (cookies seteadas por @supabase/ssr). Navegación dura
    // para que el middleware vea las cookies desde el primer request.
    window.location.assign(next);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="card p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-bnp-green/15 text-bnp-green mb-4">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold mb-2">Revisa tu correo</h2>
          <p className="text-sm text-text-secondary mb-1">
            Mandamos un código de acceso a:
          </p>
          <p className="mono text-sm font-semibold text-text-primary mb-4">
            {email}
          </p>

          <form onSubmit={handleVerify} className="space-y-3 mb-4">
            <div className="text-left">
              <label className="label flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Código de 6 dígitos
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="input input-text mono text-center text-lg tracking-[0.4em]"
                autoFocus
                disabled={verifying}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-2xs text-bnp-red border border-bnp-red/30 bg-bnp-red/10 rounded p-2 text-left">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="btn-primary w-full"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando…
                </>
              ) : (
                'Entrar al cotizador'
              )}
            </button>
          </form>

          <p className="text-2xs text-text-muted mb-6">
            El código vence en 60 minutos. Si el correo no trae código (solo un
            enlace), también puedes abrir el enlace — pero hazlo en este mismo
            navegador. Si no ves el correo, revisa spam.
          </p>

          <Link
            href="/login"
            className="text-2xs text-text-muted hover:text-text-primary inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Usar otro correo
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <Inner />
    </Suspense>
  );
}
