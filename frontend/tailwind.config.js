/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'hue-navy': {
          DEFAULT: '#002147',
          500: '#4361ff',
          700: '#1d32e0'
        },
        'hue-gold': {
          DEFAULT: '#FFB81C',
          300: '#ffe04a',
          400: '#ffd31a'
        },
        'semantic': {
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#f43f5e',
          info: '#3b82f6'
        }
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        inter: ['Inter', 'sans-serif']
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(67, 97, 255, 0.30)',
        'glow-gold': '0 0 20px rgba(255, 184, 28, 0.35)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      },
      backgroundImage: {
        'gradient-sidebar': 'linear-gradient(to bottom, #002147, #000d1f)',
        'gradient-gold': 'linear-gradient(to bottom right, #FFB81C, #FFE04A)',
        'gradient-hero': 'linear-gradient(to bottom right, #002147, #4361ff)',
        'gradient-glass': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.35s ease-out',
        'pulse-gold': 'pulseGold 2s infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'bounce-subtle': 'bounceSubtle 3s infinite ease-in-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 184, 28, 0.4)' },
          '50%': { boxShadow: '0 0 20px 5px rgba(255, 184, 28, 0.2)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' }
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(-2%)' },
          '50%': { transform: 'translateY(2%)' }
        }
      }
    },
  },
  plugins: [],
}

