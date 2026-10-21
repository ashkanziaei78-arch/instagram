import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0e0a1c',
        plum: { DEFAULT: '#171127', 2: '#211938', 3: '#2c2148' },
        haze: '#f3eefc',
        mist: '#a49bc0',
        dim: '#6f6790',
        violet: '#5b2ef0',
        magenta: '#e1306c',
        tangerine: '#fd8d32',
        sun: '#fcc730'
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Tahoma', 'sans-serif']
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #5b2ef0 0%, #c22fa8 35%, #e1306c 55%, #fd8d32 82%, #fcc730 100%)'
      }
    }
  },
  plugins: []
} satisfies Config
