'use client';

import Link from 'next/link';
import FreshnessBadge from './FreshnessBadge';
import { freshnessFromDate } from '@/lib/freshness';
import { useAuth } from '@/lib/useAuth';
import { usePriceData } from '@/lib/dataStore';

// Badge global de "última actualización de precios".
// Visible para TODOS los usuarios (vendedores y admins).
// Para admins es link al panel de admin; para vendedores es informativo.
//
// Lee del MISMO dataStore que usa el cotizador (antes hacía su propio fetch a
// /api/data/current y descargaba el dataset completo DOS veces por carga).
// generated_at = fecha del último upload de Diego = fuente de verdad.
export default function GlobalFreshnessBadge() {
  const { isAdmin } = useAuth();
  const { data, loading } = usePriceData();

  const info = data?.generated_at ? freshnessFromDate(data.generated_at) : null;
  const edsaFile = data?.source_files?.edsa ?? null;

  // Placeholder con la geometría del badge final: el nav no brinca al llegar.
  if (loading) return <div className="skeleton h-7 w-36" aria-hidden />;

  // Cuando no hay datos cargados aún, mostrar un warning visible
  if (!info) {
    return (
      <div
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-bnp-amber/40 bg-bnp-amber/10 text-bnp-amber"
        title="No hay precios cargados todavía"
      >
        <span className="text-2xs font-semibold uppercase tracking-wider">
          Sin precios cargados
        </span>
      </div>
    );
  }

  const inner = (
    <>
      <span className="text-2xs text-text-muted uppercase tracking-wider font-semibold">
        Precios actualizados
      </span>
      <FreshnessBadge info={info} prefix="" />
    </>
  );

  const tooltipText = edsaFile
    ? `Última carga: ${edsaFile}`
    : 'Última actualización de precios';

  // Admins: link al panel admin para subir nuevos
  if (isAdmin) {
    return (
      <Link
        href="/cotizador/precios"
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border-subtle hover:border-border bg-bg-surface transition-colors"
        title={`${tooltipText} — click para cargar nuevo`}
      >
        {inner}
      </Link>
    );
  }

  // Vendedores: solo informativo, no clickeable
  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border-subtle bg-bg-surface"
      title={tooltipText}
    >
      {inner}
    </div>
  );
}
