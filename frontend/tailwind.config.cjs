/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#1e3a8a', // indigo‑900
        accent: '#f59e0b', // amber‑500
      },
      fontFamily: {
        display: ['"Fira Sans"', 'system-ui'],
        body: ['"Inter"', 'system-ui'],
      },
    },
  },
  plugins: [],
};
