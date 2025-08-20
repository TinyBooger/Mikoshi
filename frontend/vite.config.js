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
      proxy: isProduction ? undefined : {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    // ✅ Add this build configuration
    build: {
      outDir: 'dist',
      rollupOptions: {
        // Ensure _redirects file is copied to build output
        input: {
          main: resolve(__dirname, 'index.html'),
        },
      },
    },
    // ✅ Copy _redirects file to dist folder
    publicDir: 'public',
    };
});