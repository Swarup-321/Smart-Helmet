/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        mine: {
          bg: '#F5F7FB',
          card: '#FFFFFF',
          primary: '#3B82F6', // Modern blue/indigo
          secondary: '#6366F1',
          safe: '#10B981',    // Emerald
          warning: '#F59E0B', // Amber
          danger: '#EF4444',  // Rose/Red
          accent: '#06B6D4',  // Teal
          muted: '#64748B',
          dark: '#0F172A'
        }
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        'card': '0 10px 30px -5px rgba(0, 0, 0, 0.04), 0 4px 12px -2px rgba(0, 0, 0, 0.02)',
        'glow-safe': '0 0 15px rgba(16, 185, 129, 0.3)',
        'glow-danger': '0 0 20px rgba(239, 68, 68, 0.4)',
        'glow-primary': '0 0 20px rgba(59, 130, 246, 0.35)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}
