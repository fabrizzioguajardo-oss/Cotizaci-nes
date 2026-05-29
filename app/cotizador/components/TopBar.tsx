'use client';

import { fmtUSD, fmtNum } from '@/lib/format';
import { TRAILER_MAX_KG } from '@/lib/pricingEngine';
import { Database, Package, Settings, LogOut, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import GlobalFreshnessBadge from './GlobalFreshnessBadge';
import OnboardingNameModal from './OnboardingNameModal';
import { useAuth } from '@/lib/useAuth';
import { APP_VERSION_LABEL, APP_ORG } from '@/lib/version';

interface Props {
  cliente: string;
  onClienteChange: (v: string) => void;
  contacto: string;
  onContactoChange: (v: string) => void;
  direccion: string;
  onDireccionChange: (v: string) => void;
  fecha: string;
  tc: number;
  onTcChange: (v: number) => void;
  totalRevenue: number;
  totalCost: number;
  utilidadGlobal: number | null;
  kgNetoTotal: number;
}

export default function TopBar(p: Props) {
  const { profile, isAdmin, signOut, refreshProfile } = useAuth();
  // Modal local para editar el nombre del vendedor. El onboarding inicial
  // (bloqueante cuando profile.name está vacío) vive en page.tsx; aquí solo
  // manejamos el caso "ya tengo nombre pero lo quiero corregir".
  const [editingName, setEditingName] = useState(false);
  const utilidadColor =
    p.utilidadGlobal === null
      ? '#64748B'
      : p.utilidadGlobal < 0
      ? '#EF4444'
      : p.utilidadGlobal < 0.12
      ? '#F59E0B'
      : '#5BAA47';

  const kgPct = (p.kgNetoTotal / TRAILER_MAX_KG) * 100;
  const kgColor = kgPct > 100 ? '#EF4444' : kgPct > 95 ? '#F59E0B' : '#5BAA47';

  return (
    <header className="border-b border-border bg-bg-elevated">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-bnp-green" />
            <div>
              <h1 className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                <span className="text-bnp-green">SICE</span>{' '}
                <span className="text-text-muted">·</span>{' '}
                <span className="text-text-primary">Cotizador</span>
                <span
                  className="ml-1 px-1.5 py-0.5 rounded text-2xs font-bold tracking-wider bg-bnp-amber/20 text-bnp-amber border border-bnp-amber/40"
                  title="Beta — reportar bugs y sugerencias"
                >
                  BETA
                </span>
              </h1>
              <p className="text-2xs text-text-muted leading-tight">{APP_ORG} · {APP_VERSION_LABEL}</p>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <GlobalFreshnessBadge />

          {/* Botones admin solo visibles para usuarios con rol 'admin' */}
          {isAdmin && (
            <>
              <Link href="/cotizador/admin" className="btn-secondary text-xs">
                <Settings className="w-3.5 h-3.5" />
                Admin de costos
              </Link>
              <Link href="/cotizador/precios" className="btn-secondary text-xs">
                <Database className="w-3.5 h-3.5" />
                Carga Excel EDSA
              </Link>
            </>
          )}

          {/* Identidad del usuario actual + editar nombre + logout */}
          {profile && (
            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-border-subtle">
              <div className="text-right hidden sm:block">
                <p className="text-2xs font-medium text-text-primary leading-tight">
                  {profile.name || profile.email.split('@')[0]}
                </p>
                <p className="text-2xs text-text-muted leading-tight">
                  {isAdmin ? 'admin' : 'vendedor'}
                </p>
              </div>
              <button
                onClick={() => setEditingName(true)}
                className="p-1.5 rounded border border-border-subtle hover:border-bnp-green/40 hover:text-bnp-green transition-colors"
                title="Editar mi nombre (aparece como firma en los PDFs)"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={signOut}
                className="p-1.5 rounded border border-border-subtle hover:border-bnp-red/40 hover:text-bnp-red transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Modal de edición del nombre (no bloqueante — el onboarding inicial
              vive en page.tsx). Reload al guardar para que useAuth recargue
              el profile fresco desde Supabase. */}
          {profile && (
            <OnboardingNameModal
              open={editingName}
              mode="edit"
              initialEmail={profile.email}
              initialName={profile.name ?? ''}
              onSaved={() => {
                // Re-lee el profile sin recargar (preserva trabajo en curso).
                void refreshProfile();
                setEditingName(false);
              }}
              onCancel={() => setEditingName(false)}
            />
          )}
        </nav>
      </div>

      {/* Barra de variables globales — fila 1: cliente + contacto + fecha + TC + KPIs.
          El input "Transporte (USD)" se eliminó en v1.11 — el flete se edita por
          trailer en el sidebar izquierdo, no global. */}
      <div className="px-6 py-3 border-t border-border-subtle grid grid-cols-12 gap-4 items-end">
        <div className="col-span-3">
          <label className="label">Cliente</label>
          <input
            type="text"
            value={p.cliente}
            onChange={(e) => p.onClienteChange(e.target.value)}
            placeholder="Razón social del cliente"
            className="input input-text"
          />
        </div>
        <div className="col-span-3">
          <label className="label">Contacto cliente</label>
          <input
            type="text"
            value={p.contacto}
            onChange={(e) => p.onContactoChange(e.target.value)}
            placeholder="Nombre del comprador"
            className="input input-text"
          />
        </div>
        <div className="col-span-1">
          <label className="label">Fecha</label>
          <input type="text" value={p.fecha} disabled className="input opacity-70" />
        </div>
        <div className="col-span-1">
          <label className="label">TC (MXN/USD)</label>
          <input
            type="number" step="0.01"
            value={p.tc || ''}
            onChange={(e) => p.onTcChange(parseFloat(e.target.value) || 0)}
            className="input"
          />
        </div>

        <div className="col-span-4 grid grid-cols-4 gap-3">
          <div className="bg-bg-surface rounded-md p-2.5 text-center">
            <p className="text-2xs text-text-muted uppercase tracking-wider">Revenue</p>
            <p className="mono text-sm font-semibold mt-0.5 text-bnp-green">
              {fmtUSD(p.totalRevenue)}
            </p>
          </div>
          <div className="bg-bg-surface rounded-md p-2.5 text-center">
            <p className="text-2xs text-text-muted uppercase tracking-wider">Costo</p>
            <p className="mono text-sm font-semibold mt-0.5">{fmtUSD(p.totalCost)}</p>
          </div>
          <div className="bg-bg-surface rounded-md p-2.5 text-center">
            <p className="text-2xs text-text-muted uppercase tracking-wider">Utilidad</p>
            <p className="mono text-sm font-semibold mt-0.5" style={{ color: utilidadColor }}>
              {p.utilidadGlobal === null ? '—' : `${(p.utilidadGlobal * 100).toFixed(1)}%`}
            </p>
          </div>
          <div className="bg-bg-surface rounded-md p-2.5 text-center">
            <p className="text-2xs text-text-muted uppercase tracking-wider">KG trailer</p>
            <p className="mono text-sm font-semibold mt-0.5" style={{ color: kgColor }}>
              {fmtNum(p.kgNetoTotal, 0)} / {fmtNum(TRAILER_MAX_KG, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Fila 2: dirección de entrega del cliente. Multilínea porque típicamente
          son 3-4 renglones (calle, ciudad, estado, país). Va al PDF de cotización. */}
      <div className="px-6 pb-3 grid grid-cols-12 gap-4 items-start">
        <div className="col-span-12">
          <label className="label">Dirección de entrega del cliente</label>
          <textarea
            value={p.direccion}
            onChange={(e) => p.onDireccionChange(e.target.value)}
            placeholder={'Calle y número\nCiudad, Estado\nCP · País'}
            rows={2}
            className="input input-text resize-none font-mono text-xs"
          />
        </div>
      </div>
    </header>
  );
}
