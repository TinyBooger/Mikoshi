// frontend/vite.config.mjs



import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';

// Manually load .env from the frontend directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,  // Always use 3000
    strictPort: true,  // Fail if port is occupied
    host: 'localhost',  // Use localhost for development
    proxy: {
      // Proxy all /api requests to your backend
      '/api': {
        target: process.env.VITE_API_BASE_URL,
        changeOrigin: true,
      },
    },
  },
});
