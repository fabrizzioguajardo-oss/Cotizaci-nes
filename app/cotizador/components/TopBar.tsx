'use client';

import { fmtUSD, fmtNum } from '@/lib/format';
import { TRAILER_MAX_KG } from '@/lib/pricingEngine';
import { Database, Package, Settings, LogOut, Pencil, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import GlobalFreshnessBadge from './GlobalFreshnessBadge';
import OnboardingNameModal from './OnboardingNameModal';
import WhatsNewModal, { WHATS_NEW_KEY } from './WhatsNewModal';
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
  usaTC: boolean;            // EUA usa TC; México no
  moneda: 'USD' | 'MXN';
  empresaNombre: string;
  empresaAccent: string;
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
  // Modal de novedades: aparece UNA vez por usuario cuando la versión cambia
  // (clave en localStorage). Re-abrible con el botón "Novedades".
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  useEffect(() => {
    try {
      // En la PRIMERA visita absoluta NO mostramos Novedades: a alguien que
      // nunca vio la app, un "qué hay de nuevo" no le dice nada y solo se
      // encima del onboarding del nombre. Marcamos la app como vista y esta
      // versión como "ya conocida"; las versiones FUTURAS sí saltarán una vez.
      const yaUsoLaApp = localStorage.getItem('sice_app_seen') === '1';
      if (!yaUsoLaApp) {
        localStorage.setItem('sice_app_seen', '1');
        localStorage.setItem(WHATS_NEW_KEY, '1');
        return;
      }
      if (localStorage.getItem(WHATS_NEW_KEY) !== '1') setWhatsNewOpen(true);
    } catch {
      // localStorage no disponible (modo privado raro): no auto-mostrar.
    }
  }, []);
  const closeWhatsNew = () => {
    setWhatsNewOpen(false);
    try {
      localStorage.setItem(WHATS_NEW_KEY, '1');
    } catch {}
  };

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

  // En EUA el TC es obligatorio: si el vendedor lo borra y queda en 0, las
  // conversiones de costo a USD se corrompen en silencio (margen/precio mal).
  // Lo marcamos en rojo para que NO pase inadvertido.
  const tcInvalido = p.usaTC && (!p.tc || p.tc <= 0);

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
                  className="ml-1 px-1.5 py-0.5 rounded text-2xs font-semibold tracking-wider bg-bg-surface text-text-muted border border-border-subtle"
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
          <button
            onClick={() => setWhatsNewOpen(true)}
            className="btn-secondary text-xs"
            title={`Novedades de la versión ${APP_VERSION_LABEL}`}
          >
            <Rocket className="w-3.5 h-3.5" />
            Novedades
          </button>

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
                className="p-2 rounded border border-border-subtle hover:border-bnp-green/40 hover:text-bnp-green transition-colors"
                title="Editar mi nombre (aparece como firma en los PDFs)"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {/* Logout separado del resto (ml-3) para no picarlo por error
                  cuando se busca editar el nombre — es una acción que tira la
                  sesión y el trabajo en curso. */}
              <button
                onClick={signOut}
                className="p-2 ml-3 rounded border border-border-subtle hover:border-bnp-red/40 hover:text-bnp-red transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
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

          {/* Modal de novedades de la versión (auto-show 1 vez + botón Novedades) */}
          <WhatsNewModal open={whatsNewOpen} onClose={closeWhatsNew} />
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
        {/* TC solo para EUA (USD). México opera en MXN sin tipo de cambio. */}
        {p.usaTC ? (
          <div className="col-span-1">
            <label
              className="label"
              title="TC = tipo de cambio MXN por USD. Convierte el costo (en pesos) a dólares para la cotización."
            >
              TC (MXN/USD)
            </label>
            <input
              type="number" step="0.01" min="0"
              value={p.tc || ''}
              onChange={(e) => p.onTcChange(parseFloat(e.target.value) || 0)}
              className={`input ${tcInvalido ? 'border-bnp-red text-bnp-red' : ''}`}
              title={tcInvalido ? 'Sin tipo de cambio, el precio y el margen no se calculan bien.' : undefined}
            />
            {tcInvalido && (
              <p className="text-2xs text-bnp-red mt-0.5 leading-tight">Pon el tipo de cambio</p>
            )}
          </div>
        ) : (
          <div className="col-span-1">
            <label className="label">Moneda</label>
            <div
              className="input flex items-center font-semibold cursor-default"
              style={{ color: p.empresaAccent }}
              title="México opera en pesos mexicanos, sin tipo de cambio"
            >
              MXN
            </div>
          </div>
        )}

        <div className="col-span-4 grid grid-cols-4 gap-3 items-stretch">
          {/* Revenue y Costo a gris: son auditoría, no la decisión del vendedor.
              Antes Revenue iba en verde y competía con el verde de marca/acción. */}
          <div className="bg-bg-surface rounded-md p-2.5 text-center">
            <p className="text-2xs text-text-muted uppercase tracking-wider">Revenue {p.moneda}</p>
            <p className="mono text-sm font-medium mt-0.5 text-text-secondary">
              {fmtUSD(p.totalRevenue)}
            </p>
          </div>
          <div className="bg-bg-surface rounded-md p-2.5 text-center">
            <p className="text-2xs text-text-muted uppercase tracking-wider">Costo {p.moneda}</p>
            <p className="mono text-sm font-medium mt-0.5 text-text-secondary">{fmtUSD(p.totalCost)}</p>
          </div>
          {/* Utilidad: el dato que importa de un vistazo — ÚNICO KPI resaltado
              (borde + color del semáforo + número más grande). */}
          <div
            className="rounded-md p-2.5 text-center border"
            style={{ backgroundColor: `${utilidadColor}14`, borderColor: `${utilidadColor}55` }}
          >
            <p className="text-2xs uppercase tracking-wider font-semibold" style={{ color: utilidadColor }}>
              Utilidad
            </p>
            <p className="mono text-base font-bold mt-0.5" style={{ color: utilidadColor }}>
              {p.utilidadGlobal === null ? '—' : `${(p.utilidadGlobal * 100).toFixed(1)}%`}
            </p>
          </div>
          <div className="bg-bg-surface rounded-md p-2.5 text-center">
            <p className="text-2xs text-text-muted uppercase tracking-wider">KG neto</p>
            <p className="mono text-sm font-medium mt-0.5" style={{ color: kgColor }}>
              {p.usaTC
                ? `${fmtNum(p.kgNetoTotal, 0)} / ${fmtNum(TRAILER_MAX_KG, 0)}`
                : fmtNum(p.kgNetoTotal, 0)}
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
