'use client';

import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: React.ReactNode;
}

// Bloquea acceso a rutas admin si el usuario no tiene rol 'admin'.
// Se monta en el client, así que un vendedor que entre por URL directa ve
// un mensaje claro y un link de regreso.
// Defense-in-depth: la BD ya rechaza writes de no-admins via RLS policies.
export default function AdminGuard({ children }: Props) {
  const { profile, loading, isAdmin } = useAuth();
  const router = useRouter();

  // Si no hay perfil (no logueado), middleware ya redirigió a /login
  // pero por si acaso, redirigir explícitamente
  useEffect(() => {
    if (!loading && !profile) {
      router.replace('/login');
    }
  }, [loading, profile, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-bnp-green" />
      </div>
    );
  }

  if (!profile) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="card p-6 max-w-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-bnp-amber/15 text-bnp-amber mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold mb-1">Acceso restringido</h2>
          <p className="text-sm text-text-secondary mb-4">
            Esta página es solo para administradores (Diego y Fabrizzio).
          </p>
          <p className="text-2xs text-text-muted mono mb-4">
            Tu rol actual: {profile.role}
          </p>
          <Link href="/cotizador" className="btn-primary inline-flex">
            Volver al cotizador
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
