'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import FeedbackModal from './FeedbackModal';

// Boton flotante de feedback. Al click abre un modal con 3 opciones cross-platform:
//   - Gmail web (funciona en cualquier sistema, no requiere app)
//   - mailto (para Mac/iOS y Windows con Outlook configurado)
//   - copiar al portapapeles (siempre funciona)
// Fix de v1.01: antes era mailto directo que fallaba silencioso en Windows.
export default function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-bnp-amber text-black font-semibold text-xs shadow-lg hover:bg-bnp-amber/90 transition-all hover:scale-105"
        title="Reportar un bug, una mejora o una sugerencia"
      >
        <MessageSquarePlus className="w-4 h-4" />
        Reportar
      </button>

      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
