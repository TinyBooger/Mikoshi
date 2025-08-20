// frontend/vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const isProduction = env.ENVIRONMENT === 'production' || mode === 'production';

  return {
    plugins: [
      react(),
      // ✅ Copy _redirects to dist folder
      viteStaticCopy({
        targets: [
          {
            src: 'public/_redirects',
            dest: '.'
          }
        ]
      })
    ],
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
    build: {
      outDir: 'dist',
    },
    publicDir: 'public',
  };
});