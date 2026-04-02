/** @type {import('tailwindcss').Config} */
export default {
  content: ['./popup.html', './sidepanel.html', './src/**/*.{svelte,js,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f5f5f7',
          dark: '#2c2c2e',
        },
        border: {
          DEFAULT: '#e5e5e7',
          dark: '#38383a',
        },
      },
    },
  },
  plugins: [],
};
