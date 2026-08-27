'use client';

// Tooltip CSS puro (sin dependencias): card elevada con hairline y sombra de
// popover, aparece con delay de 400ms al hover (y sin delay al enfocar con
// teclado), entrada opacity+scale de 150ms. Sustituye los title= nativos
// informativos, que tardan ~1s, no se pueden estilar y no funcionan en touch.
//
// Uso:
//   <Tooltip content={GLOSARIO.pn}><span>PN</span></Tooltip>
//   <Tooltip content="..." underline>...  ← subrayado punteado "esto explica algo"

import type { ReactNode } from 'react';

interface Props {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  // Subrayado punteado en el trigger (señal de "pasa el cursor aquí")
  underline?: boolean;
}

export default function Tooltip({ content, children, side = 'top', underline = false }: Props) {
  return (
    <span
      className={`tooltip-trigger ${underline ? 'tooltip-underline' : ''}`}
      tabIndex={0}
    >
      {children}
      <span role="tooltip" className={`tooltip-panel ${side === 'top' ? 'tooltip-top' : 'tooltip-bottom'}`}>
        {content}
      </span>
    </span>
  );
}
