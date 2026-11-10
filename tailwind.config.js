/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Dana', 'Segoe UI', 'Tahoma', 'sans-serif'] },
      colors: {
        // رنگ‌های دایرکتینو — همان پالت سایت
        ink: { 900: '#0e0a1c', 800: '#171127', 700: '#211938', 600: '#2c2148' },
        brand: { 50: '#fdf2f8', 400: '#e1306c', 500: '#c22fa8', 600: '#5b2ef0' },
        haze: '#f3eefc',
        mist: '#a49bc0'
      }
    }
  },
  plugins: []
}
