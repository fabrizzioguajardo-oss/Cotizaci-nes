// Hooks de micro-animación para valores numéricos (KPIs, costos, totales).
// - useValuePulse: devuelve una className que "pulsa" (fondo del acento al 20%
//   → transparente, 400ms) cada vez que el valor cambia. Usa .value-pulse de
//   globals.css, que es conmutable por empresa vía --bnp-green.
// - useAnimatedNumber: interpola el número mostrado hacia el valor real en
//   200ms con easing out-quart (requestAnimationFrame). El vendedor "ve" el
//   número moverse al jugar con el precio, sin esperas ni brincos.

'use client';

import { useEffect, useRef, useState } from 'react';

export function useValuePulse(value: unknown): string {
  const [pulsing, setPulsing] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 400);
    return () => clearTimeout(t);
  }, [value]);

  return pulsing ? 'value-pulse' : '';
}

export function useAnimatedNumber(target: number, durationMs = 200): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Valores no finitos o primera render: sin animación.
    if (!isFinite(target)) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;

    // Respeto a prefers-reduced-motion: salto directo.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 4); // out-quart
      const val = from + (target - from) * eased;
      setDisplay(val);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return display;
}
