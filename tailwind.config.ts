import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0D1117',
          elevated: '#161B22',
          surface: '#1C2129',
          hover: '#21262D',
        },
        border: {
          DEFAULT: '#30363D',
          subtle: '#21262D',
        },
        text: {
          primary: '#E6EDF3',
          secondary: '#8B949E',
          muted: '#6E7681',
        },
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
      boxShadow: {
        'inner-border': 'inset 0 0 0 1px rgba(48, 54, 61, 0.6)',
        'glow-green': '0 0 0 3px rgba(91, 170, 71, 0.15)',
        'glow-cyan': '0 0 0 3px rgba(0, 159, 227, 0.15)',
        'glow-amber': '0 0 0 3px rgba(245, 158, 11, 0.15)',
      },
    },
  },
  plugins: [],
};

export default config;
