// frontend/vite.config.mjs



import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

if (process.env.ENVIRONMENT !== 'production') {
    import('dotenv').then(dotenv => {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    });
}

const apiBaseUrl = process.env.VITE_API_BASE_URL;
console.log('VITE_API_BASE_URL for proxy:', apiBaseUrl);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,  // Always use 3000
    strictPort: true,  // Fail if port is occupied
    host: 'localhost',  // Use localhost for development
    proxy: {
      // Proxy all /api requests to your backend
      '/api': {
        target: apiBaseUrl,
        changeOrigin: true,
      },
    },
  },
});
