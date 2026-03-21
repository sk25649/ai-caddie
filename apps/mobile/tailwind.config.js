/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#d4a843',
          dim: '#a08030',
        },
        green: {
          deep: '#0a1a0a',
          mid: '#142814',
          card: '#0f200f',
        },
        cream: {
          DEFAULT: '#f0e8d8',
          dim: '#b8a888',
        },
        danger: '#e05545',
        'par-green': '#3dbd6e',
      },
      fontFamily: {
        display: ['DM Serif Display'],
        body: ['DM Sans'],
      },
    },
  },
  plugins: [],
};
