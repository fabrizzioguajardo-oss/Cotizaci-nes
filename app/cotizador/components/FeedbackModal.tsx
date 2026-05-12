'use client';

import { useState, useEffect } from 'react';
import { X, Mail, Copy, Check, ExternalLink } from 'lucide-react';

const FEEDBACK_EMAIL = 'fabrizzio.guajardo@bionovapack.com';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Modal de feedback cross-platform.
// Reemplaza el mailto: directo (que rompe en Windows sin app de correo configurada).
// Da 3 caminos al usuario:
//   1. Abrir Gmail web con el mensaje pre-rellenado (funciona en cualquier sistema)
//   2. Copiar al portapapeles (manda manual donde quiera)
//   3. Abrir app de correo nativa (mailto, para los que si la tienen)
export default function FeedbackModal({ open, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const subject = `[Cotizador BETA] Reporte de ${new Date().toLocaleDateString('es-MX')}`;
  const fullBody = [
    message.trim() || '(escribe tu mensaje aqui)',
    '',
    '',
    '──────────────────────────',
    'Version: v0.1.0-beta',
    `URL: ${typeof window !== 'undefined' ? window.location.href : ''}`,
    `Fecha: ${new Date().toLocaleString('es-MX')}`,
    `Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
  ].join('\n');

  const handleGmail = () => {
    const url = `https://mail.google.com/mail/?view=cm&to=${FEEDBACK_EMAIL}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleMailto = () => {
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
    window.location.href = url;
  };

  const handleCopy = async () => {
    const text = `Para: ${FEEDBACK_EMAIL}\nAsunto: ${subject}\n\n${fullBody}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback para navegadores viejos
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {}
      document.body.removeChild(ta);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={onClose}
    >
      <div
        className="card max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header">
          <h3 className="text-sm font-semibold">Reportar bug o sugerencia</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bg-hover rounded"
            title="Cerrar (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="card-body space-y-4">
          <div>
            <label className="label">Tu mensaje</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe el bug, la mejora, o lo que no entendiste..."
              rows={5}
              className="input input-text resize-none"
              autoFocus
            />
            <p className="text-2xs text-text-muted mt-1">
              Se agrega automaticamente: version, URL actual, fecha, navegador.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
              Elige cómo enviarlo
            </p>

            <button
              onClick={handleGmail}
              className="btn-primary w-full justify-start"
              disabled={!message.trim()}
            >
              <Mail className="w-4 h-4" />
              <span className="flex-1 text-left">Abrir Gmail web</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </button>

            <button
              onClick={handleMailto}
              className="btn-secondary w-full justify-start"
              disabled={!message.trim()}
            >
              <Mail className="w-4 h-4" />
              <span className="flex-1 text-left">Abrir mi app de correo</span>
            </button>

            <button
              onClick={handleCopy}
              className="btn-secondary w-full justify-start"
              disabled={!message.trim()}
            >
              {copied ? <Check className="w-4 h-4 text-bnp-green" /> : <Copy className="w-4 h-4" />}
              <span className="flex-1 text-left">
                {copied ? 'Copiado al portapapeles' : 'Copiar para enviar manual'}
              </span>
            </button>
          </div>

          <div className="border-t border-border-subtle pt-3">
            <p className="text-2xs text-text-muted">
              Destinatario: <span className="mono text-text-secondary">{FEEDBACK_EMAIL}</span>
            </p>
            <p className="text-2xs text-text-muted">
              Si nada funciona, manda WhatsApp directo. Cualquier reporte es util.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
