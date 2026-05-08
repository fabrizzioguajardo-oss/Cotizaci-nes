import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SICE Cotizador — BioNovaPack',
  description: 'Cotizador inteligente con sugerencia de spec real para planta',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
