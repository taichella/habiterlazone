/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      colors: {
        hlzPurple: '#A621FF',
        hlzDark: '#0A0A0A',
        hlzGray: '#1F1F1F',
      }
    },
  },
  plugins: [],
}