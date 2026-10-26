import './i18n';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap-icons/font/bootstrap-icons.css';
// KaTeX ships its own font metrics/faces; without this stylesheet math renders
// as unstyled overlapping glyphs.
import 'katex/dist/katex.min.css';
import { AuthProvider } from './components/AuthProvider';
import ToastProvider from './components/ToastProvider';
import { errorLogger } from './utils/errorLogger';
import { installIntentPrefetch } from './utils/routePrefetch';
import { clearLegacyQueryPersistence, queryClient } from './lib/queryClient';

// Set global API base URL - this runs before any component code
const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
window.API_BASE_URL = envApiBaseUrl && envApiBaseUrl.trim() !== ""
  ? envApiBaseUrl
  : window.location.origin;

// Initialize error logging with global handlers
errorLogger.init();

// The list cache stays in memory; only the obsolete persisted copy is removed.
clearLegacyQueryPersistence();
installIntentPrefetch();

// index.html preloads the popular list, so the response may already be in
// flight (or resolved) by the time the bundle runs. Seeding the query cache
// keeps the preload useful without a second request.
const preloadedPopularList = window.__POPULAR_LIST_PRELOAD__;
if (preloadedPopularList && typeof preloadedPopularList.then === 'function') {
  preloadedPopularList
    .then((payload) => {
      if (!Array.isArray(payload?.items) || payload.items.length === 0) return;
      if (queryClient.getQueryData(['public-list', 'characters', 'popular'])) return;
      queryClient.setQueryData(['public-list', 'characters', 'popular'], {
        pages: [{
          items: payload.items,
          total: payload.total || payload.items.length,
          page: 1,
          pageSize: payload.page_size || payload.items.length,
          hasMore: true,
        }],
        pageParams: [1],
      });
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);