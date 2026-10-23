/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ocean: {
          950: '#040d18',
          900: '#061426',
          850: '#091c33',
          800: '#0e294b',
          700: '#173f6f',
          600: '#225b9e',
        },
        cyan: {
          400: '#22D3EE',
          500: '#06B6D4',
        },
        teal: {
          400: '#2DD4BF',
        },
        termux: {
          bg: '#020912',
          text: '#22D3EE',
          emerald: '#10B981',
          dim: '#387b9c',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Consolas', 'Menlo', 'monospace'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      }
    },
  },
  plugins: [],
}

