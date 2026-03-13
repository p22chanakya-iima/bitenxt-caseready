import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0f2744',
        'navy-light': '#162d4e',
        'navy-elevated': '#1e3a5f',
        cream: '#f5f0e8',
        'cream-muted': '#a8b8cc',
        accent: '#4a90d9',
        'border-col': '#2a4a6b',
        'status-green': '#22c55e',
        'status-yellow': '#f59e0b',
        'status-red': '#ef4444',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
