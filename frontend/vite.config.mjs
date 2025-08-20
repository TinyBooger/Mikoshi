// frontend/vite.config.mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,  // Always use 3000
    strictPort: true,  // Fail if port is occupied
    host: 'localhost',  // Use localhost for development
    proxy: process.env.ENVIRONMENT !== 'production' ?{
      // Proxy all /api requests to your backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    } : undefined,
  },
});
