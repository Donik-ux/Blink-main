export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // AMOLED чёрный вместо серого
        bg: '#000000',
        surface: '#0f0f0f',
        surface2: '#1a1a1a',
        accent: '#00d9ff',
        accent2: '#ff006e',
        accent3: '#8338ec',
        muted: 'rgba(255,255,255,0.5)',
        border: 'rgba(255,255,255,0.1)',
        online: '#00ff41',
        ghost: '#ffd60a',
        offline: '#4a4a4a',
        success: '#00d084',
        warning: '#ff9500',
        danger: '#ff3333',
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        slideUp: 'slideUp 0.3s ease-out',
        fadeIn: 'fadeIn 0.2s ease-in',
        glow: 'glow 2s ease-in-out infinite',
        bounce: 'bounce 1s infinite',
        spin: 'spin 1s linear infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 217, 255, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 217, 255, 1)' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
