/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Vazirmatn', 'Segoe UI', 'Tahoma', 'sans-serif'] },
      colors: {
        ink: { 900: '#0b0f17', 800: '#111726', 700: '#18203300', 600: '#1c2436' },
        brand: { 50: '#fdf2f8', 400: '#e1306c', 500: '#c13584', 600: '#833ab4' }
      }
    }
  },
  plugins: []
}
