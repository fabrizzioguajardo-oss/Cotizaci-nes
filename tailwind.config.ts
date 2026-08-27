import type { Config } from 'tailwindcss';

// Design tokens — dirección "Precisión de Planta" (Linear/Vercel/Stripe-like):
// dark casi negro con tinte azul-frío, escalera de superficies de 4 peldaños,
// border-first (hairlines translúcidos, sombras solo en overlays), acento de
// marca conmutable por empresa, números tabulares, movimiento <300ms.
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0C0D10',
          elevated: '#14161B',
          surface: '#1A1D23',
          hover: 'rgba(255, 255, 255, 0.05)',
        },
        border: {
          DEFAULT: '#2A2E37',
          subtle: 'rgba(255, 255, 255, 0.08)',
        },
        text: {
          primary: '#F7F8F8',
          secondary: '#B4B8BF',
          muted: '#8A8F98',
          disabled: '#62666D',
        },
        // Semánticos independientes del acento de marca (estados soft:
        // texto del color + fondo del mismo color al 10-15%).
        success: '#4ADE80',
        warning: '#FBBF24',
        danger: '#F87171',
        bnp: {
          // Acentos de marca conmutables por empresa (verde BNP / navy Extruidos).
          // Definidos como variables CSS (canales RGB) en globals.css; el
          // override [data-empresa="extruidos"] los cambia a navy/azul. amber,
          // red y purple NO cambian (semánticos / compartidos).
          green: 'rgb(var(--bnp-green) / <alpha-value>)',
          'green-dark': 'rgb(var(--bnp-green-dark) / <alpha-value>)',
          'green-light': 'rgb(var(--bnp-green-light) / <alpha-value>)',
          purple: '#6B2C91',
          'purple-dark': '#552175',
          'purple-light': '#8945B2',
          cyan: 'rgb(var(--bnp-cyan) / <alpha-value>)',
          'cyan-dark': 'rgb(var(--bnp-cyan-dark) / <alpha-value>)',
          amber: '#F59E0B',
          red: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        '2xs': '0.6875rem',
      },
      // Escalera de radios unificada (antes convivían 4/6/8px sin criterio):
      // sm badges/chips, DEFAULT/md inputs y botones, lg cards.
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '10px',
      },
      boxShadow: {
        'inner-border': 'inset 0 0 0 1px rgba(42, 46, 55, 0.6)',
        // Acento conmutable: en Extruidos el glow se vuelve navy solo.
        'glow-green': '0 0 0 3px rgb(var(--bnp-green) / 0.15)',
        'glow-cyan': '0 0 0 3px rgba(0, 159, 227, 0.15)',
        'glow-amber': '0 0 0 3px rgba(245, 158, 11, 0.15)',
        // Profundidad "física": highlight interior superior de 1px (la luz de
        // arriba) + sombra corta. Overlays con sombra apilada + hairline.
        card: '0 1px 2px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        popover: '0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        modal: '0 16px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04)',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      keyframes: {
        reveal: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'overlay-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'modal-in': {
          from: { opacity: '0', transform: 'scale(0.96) translateY(4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        shimmer: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(100%)' },
        },
      },
      animation: {
        reveal: 'reveal 250ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'overlay-in': 'overlay-in 150ms ease-out both',
        'modal-in': 'modal-in 180ms cubic-bezier(0.23, 1, 0.32, 1) both',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
