// frontend/vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables for the current mode
  const env = loadEnv(mode, process.cwd());
  const isProduction = env.ENVIRONMENT === 'production' || mode === 'production';

  // Where the dev proxy sends backend traffic.
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8000';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: true,
      host: 'localhost',
      // Dev is same-origin, exactly like production. `VITE_API_BASE_URL` is
      // empty, so `window.API_BASE_URL` falls back to `window.location.origin`
      // and the app requests `/api/...` + `/static/...` from its own origin —
      // here that is the dev server, which forwards them to the backend, the
      // same job nginx does in production.
      //
      // Why this matters: without it, media URLs point at an absolute backend
      // origin, so every image is cross-origin in dev only. That is where the
      // share-card exporter's CORS failures come from — bugs that cannot happen
      // in production and are therefore easy to "fix" in the wrong place.
      proxy: {
        // `ws: true` is required for `/api/chat/voice-to-text/stream`, which is
        // a WebSocket, not a plain request.
        //
        // The long timeouts cover the SSE streaming endpoint `POST /api/chat`:
        // generation can legitimately run for minutes, and a stream cut short
        // looks like a broken model rather than a proxy bug. They mirror nginx's
        // `proxy_read_timeout 300s`. The trade-off is that a genuinely hung call
        // also takes 5 minutes to fail in dev; that is the right way round.
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
          timeout: 300000,
          proxyTimeout: 300000,
        },
        // Backend-served uploads (`/static/images/...`). Production nginx
        // proxies this path too.
        '/static': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});