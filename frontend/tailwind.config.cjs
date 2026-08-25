module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f9fc',
          100: '#e8eef7',
          200: '#c8d5e6',
          300: '#9cb0c8',
          400: '#6f89a6',
          500: '#4a6784',
          600: '#35506a',
          700: '#24384c',
          800: '#162637',
          900: '#0b1521',
        },
        accent: '#ff6a3d',
        accent2: '#19c37d',
      },
      boxShadow: {
        glow: '0 24px 80px rgba(25, 195, 125, 0.18)',
      },
    },
  },
  plugins: [],
};
