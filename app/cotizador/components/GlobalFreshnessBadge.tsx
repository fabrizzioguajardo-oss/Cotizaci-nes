'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import FreshnessBadge from './FreshnessBadge';
import { oldestFreshness, type FreshnessInfo } from '@/lib/freshness';

// Badge global que combina la frescura de los precios base + catálogo de adders.
// Se muestra en el TopBar para que Evers vea de un vistazo si los datos están al día.
export default function GlobalFreshnessBadge() {
  const [info, setInfo] = useState<FreshnessInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/precios').then((r) => r.json()).catch(() => ({ precios: [] })),
      fetch('/api/catalog').then((r) => r.json()).catch(() => ({ entries: [] })),
    ])
      .then(([p, c]) => {
        const dates = [
          ...(p.precios ?? []).map((x: { fecha_vigencia: string }) => x.fecha_vigencia),
          ...(c.entries ?? []).map((x: { fecha_vigencia: string }) => x.fecha_vigencia),
        ];
        setInfo(oldestFreshness(dates));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <Link
      href="/cotizador/admin"
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border-subtle hover:border-border bg-bg-surface transition-colors"
      title="Ir a admin de costos"
    >
      <span className="text-2xs text-text-muted uppercase tracking-wider font-semibold">
        Datos
      </span>
      <FreshnessBadge info={info} prefix="" />
    </Link>
  );
}
