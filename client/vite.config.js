import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS включается через VITE_HTTPS=1 (нужен для тестирования Service Worker
// и push-уведомлений на телефоне). Иначе обычный http.
const useHttps = process.env.VITE_HTTPS === '1';

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    port: 5173,
    host: true, // слушаем на всех интерфейсах, чтобы телефон в той же Wi-Fi мог зайти
    open: true,
    https: useHttps ? {} : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: true, // доступ из локальной сети (с телефона)
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2019',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'leaflet-vendor': ['leaflet', 'react-leaflet'],
          'socket-vendor': ['socket.io-client'],
        },
      },
    },
  },
});