// frontend/vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables for the current mode
  const env = loadEnv(mode, process.cwd());
  const isProduction = env.ENVIRONMENT === 'production' || mode === 'production';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: true,
      host: 'localhost',
      proxy: {
        '/api': {
          target: isProduction ? 'http://43.138.173.199:8000' : 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  };
});