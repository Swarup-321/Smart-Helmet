/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['Consolas', '"SF Mono"', 'Monaco', 'monospace'],
      },
      colors: {
        // MineGuard Official Brand & Velzon Design Tokens
        brand: {
          navy: '#182B3A',
          teal: '#176B87',
          tealLight: '#8DC2D1',
          gold: '#E7B64A',
          bg: '#F3F6F8',
          secondaryText: '#6C7B88',
        },
        velzon: {
          sidebar: '#182B3A',
          sidebarHover: '#1F3446',
          sidebarActive: '#176B87',
          sidebarText: '#8797A8',
          sidebarHeading: '#5B6E80',
          topbar: '#FFFFFF',
          bg: '#F3F6F8',
          card: '#FFFFFF',
          border: '#E9EBEC',
          borderLight: '#F3F6F9',
          textMain: '#212529',
          textMuted: '#878A99',
          textHeading: '#495057',
          primary: '#176B87',
          primaryHover: '#12566D',
          primarySubtle: '#E8F2F5',
          success: '#0AB39C',
          successSubtle: '#E6F8F5',
          warning: '#F7B84B',
          warningSubtle: '#FEF8ED',
          danger: '#F06548',
          dangerSubtle: '#FDEEEB',
          info: '#299CDB',
          infoSubtle: '#EAF5FB',
        },
        // Backward-compatible tokens mapped cleanly to Velzon system
        industry: {
          bg: '#F3F6F8',
          surface: '#FFFFFF',
          sidebar: '#182B3A',
          sidebarHover: '#1F3446',
          sidebarActive: '#176B87',
          sidebarMuted: '#8797A8',
          textPrimary: '#212529',
          textSecondary: '#6C7B88',
          textMuted: '#878A99',
          border: '#E9EBEC',
          borderLight: '#F3F6F9',
          accent: '#176B87',
          accentHover: '#12566D',
          accentSubtle: '#E8F2F5',
          gold: '#E7B64A',
          goldBg: '#FEF8ED',
          goldBorder: '#FDE8BE',
          safe: '#0AB39C',
          safeBg: '#E6F8F5',
          safeBorder: '#B9ECE3',
          warning: '#F7B84B',
          warningBg: '#FEF8ED',
          warningBorder: '#FDE8BE',
          danger: '#F06548',
          dangerBg: '#FDEEEB',
          dangerBorder: '#FACCC3',
          info: '#299CDB',
          infoBg: '#EAF5FB',
          infoBorder: '#C1E2F5'
        }
      },
      borderRadius: {
        'panel': '0.375rem', // 6px - Velzon standard card radius
        'control': '0.25rem', // 4px
        'pill': '9999px'
      },
      boxShadow: {
        'card': '0 1px 2px rgba(56, 65, 74, 0.15)',
        'topbar': '0 1px 2px rgba(56, 65, 74, 0.08)',
        'dropdown': '0 5px 10px rgba(30, 32, 37, 0.12)',
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}
