/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  // Classes montadas em runtime (bg-type-${type}) não são vistas pelo scanner do Tailwind.
  safelist: [
    'bg-type-normal',
    'bg-type-fire',
    'bg-type-water',
    'bg-type-electric',
    'bg-type-grass',
    'bg-type-ice',
    'bg-type-fighting',
    'bg-type-poison',
    'bg-type-ground',
    'bg-type-flying',
    'bg-type-psychic',
    'bg-type-bug',
    'bg-type-rock',
    'bg-type-ghost',
    'bg-type-dragon',
    'bg-type-dark',
    'bg-type-steel',
    'bg-type-fairy',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#08080a',
          800: '#0b0b0e',
          700: '#121216',
          600: '#17171d',
          500: '#1e1e26',
          400: '#2a2a34',
        },
        flame: {
          DEFAULT: '#ee1515',
          soft: '#ff3b3b',
          deep: '#a80f0f',
        },
        gold: '#ffcb05',
        mist: '#8b8b99',
        // Cores oficiais dos 18 tipos
        type: {
          normal: '#9fa19f', fire: '#e62829', water: '#2980ef', electric: '#fac000',
          grass: '#3fa129', ice: '#3fd8ff', fighting: '#ff8000', poison: '#9141cb',
          ground: '#915121', flying: '#81b9ef', psychic: '#ef4179', bug: '#91a119',
          rock: '#afa981', ghost: '#704170', dragon: '#5060e1', dark: '#50413f',
          steel: '#60a1b8', fairy: '#ef70ef',
        },
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        dex: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        cell: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.9)',
        glow: '0 0 0 1px rgba(238,21,21,0.5), 0 0 28px -6px rgba(238,21,21,0.55)',
      },
      keyframes: {
        'dex-in': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'scan-line': {
          '0%,100%': { transform: 'translateY(-42%)' },
          '50%': { transform: 'translateY(42%)' },
        },
      },
      animation: {
        'dex-in': 'dex-in .28s cubic-bezier(.2,.8,.2,1) both',
        'scan-line': 'scan-line 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
