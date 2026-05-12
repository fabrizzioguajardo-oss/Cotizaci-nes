'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';

function Inner() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="card p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-bnp-green/15 text-bnp-green mb-4">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold mb-2">Revisa tu correo</h2>
          <p className="text-sm text-text-secondary mb-1">
            Te mandamos un enlace de acceso a:
          </p>
          <p className="mono text-sm font-semibold text-text-primary mb-4">
            {email}
          </p>
          <p className="text-2xs text-text-muted mb-6">
            Click el enlace dentro de los próximos 60 minutos para entrar al cotizador.
            Si no lo ves, revisa la carpeta de spam.
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
