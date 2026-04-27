/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ─── LIVO Design System — Color Tokens ───────────────────
      colors: {
        // Primarios
        'electric-blue': '#0000E1',
        'lime':          '#DEFF00',
        // Secundarios
        'orange-vivo':   '#FC4F00',
        'pink-promo':    '#D92D8E',
        // Escala tonal Blue (LIVO)
        blue: {
          50:  '#F2F2FD',
          100: '#E6E6FC',
          200: '#CCCCF9',
          300: '#A6A6F4',
          400: '#6666ED',
          500: '#3333E8',
          600: '#0000E1',  // Electric Blue — color principal
          700: '#0000BF',
          800: '#000071',
          900: '#000044',
        },
        // Escala tonal Lime (LIVO)
        lime: {
          50:  '#FDFFF2',
          100: '#FCFFE6',
          200: '#F8FFCC',
          300: '#DEFF00',  // Lime — acento principal
          400: '#EBFF66',
          500: '#DEFF00',
          600: '#BDD900',
          700: '#9BB300',
          800: '#6F8000',
          900: '#434D00',
        },
      },
      // ─── LIVO Typography ──────────────────────────────────────
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        body:    ['Poppins', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        sans:    ['Poppins', 'system-ui', 'sans-serif'],
      },
      // ─── Sidebar dimensions ───────────────────────────────────
      width: {
        sidebar: '252px',
      },
      minWidth: {
        sidebar: '252px',
      },
      // ─── Custom shadows (LIVO scale) ─────────────────────────
      boxShadow: {
        'livo-sm':  '0 1px 2px rgba(0,0,0,0.05)',
        'livo-md':  '0 4px 6px rgba(0,0,0,0.10)',
        'livo-lg':  '0 10px 15px rgba(0,0,0,0.14)',
        'livo-xl':  '0 20px 25px rgba(0,0,0,0.18)',
        'livo-2xl': '0 25px 50px rgba(0,0,0,0.25)',
      },
      // ─── Border radius extras ─────────────────────────────────
      borderRadius: {
        'pill': '9999px',
      },
      // ─── Animations ───────────────────────────────────────────
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        shimmer:   'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
}
