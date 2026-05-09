'use client';

import { MessageSquarePlus } from 'lucide-react';

// Boton flotante de feedback. Abre mailto con el contexto pre-rellenado
// (URL, version, fecha) para que el vendedor solo tenga que escribir el bug.
const FEEDBACK_EMAIL = 'fabrizzio.guajardo@bionovapack.com';
const VERSION = 'v0.1.0-beta';

export default function FeedbackButton() {
  const handleClick = () => {
    const subject = `[Cotizador BETA] Reporte de ${new Date().toLocaleDateString('es-MX')}`;
    const body = [
      '',
      '',
      '──────────────────────────',
      `Versión: ${VERSION}`,
      `URL: ${typeof window !== 'undefined' ? window.location.href : ''}`,
      `Fecha: ${new Date().toLocaleString('es-MX')}`,
      `Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
      '',
      '(Describe el bug, mejora o sugerencia arriba de la línea)',
    ].join('\n');

    const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-bnp-amber text-black font-semibold text-xs shadow-lg hover:bg-bnp-amber/90 transition-all hover:scale-105"
      title="Reportar un bug, una mejora o una sugerencia"
    >
      <MessageSquarePlus className="w-4 h-4" />
      Reportar
    </button>
  );
}
