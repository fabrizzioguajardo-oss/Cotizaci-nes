'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import FreshnessBadge from './FreshnessBadge';
import { freshnessFromDate, type FreshnessInfo } from '@/lib/freshness';
import { useAuth } from '@/lib/useAuth';

// Badge global de "última actualización de precios".
// Visible para TODOS los usuarios (vendedores y admins).
// Para admins es link al panel de admin; para vendedores es informativo.
//
// Lee de /api/data/current que devuelve generated_at (la fecha del último
// upload de Diego en /cotizador/precios). Esto es la fuente de verdad de
// cuándo se actualizaron los precios.
export default function GlobalFreshnessBadge() {
  const { isAdmin } = useAuth();
  const [info, setInfo] = useState<FreshnessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [edsaFile, setEdsaFile] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/data/current', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.generated_at) {
          setInfo(freshnessFromDate(data.generated_at));
          setEdsaFile(data.source_files?.edsa ?? null);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;

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
