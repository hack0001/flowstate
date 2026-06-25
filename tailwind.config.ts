import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        surface: '#12121a',
        card: '#1a1a26',
        border: '#2a2a3a',
        cyan: {
          DEFAULT: '#00d4ff',
          dim: '#00a8cc',
          glow: '#00d4ff33',
        },
        purple: {
          DEFAULT: '#8b5cf6',
          dim: '#6d3fd4',
          glow: '#8b5cf633',
        },
        green: {
          DEFAULT: '#00ff88',
          glow: '#00ff8833',
        },
        amber: {
          DEFAULT: '#ffb800',
          glow: '#ffb80033',
        },
        text: {
          primary: '#f0f0ff',
          secondary: '#8888aa',
          muted: '#4a4a6a',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'progress': 'progress 0.6s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px #00d4ff33' },
          '50%': { boxShadow: '0 0 40px #00d4ff66, 0 0 80px #00d4ff22' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        progress: {
          from: { width: '0%' },
          to: { width: 'var(--progress-width)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
