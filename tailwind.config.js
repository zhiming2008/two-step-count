/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Microsoft YaHei', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
