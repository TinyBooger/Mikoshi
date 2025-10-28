import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { AuthProvider } from './components/AuthProvider';
import ToastProvider from './components/ToastProvider';

// Set global API base URL - this runs before any component code
window.API_BASE_URL = 'http://localhost:8000'

// Dev-only: log Vite environment variables once on startup
if (import.meta && import.meta.env && import.meta.env.DEV) {
  // Built-in Vite environment variables (always available):
  // 'development' or 'production'
  console.log('VITE MODE:', import.meta.env.MODE);
  // true in production, false in development
  console.log('VITE PROD:', import.meta.env.PROD);
  // true in development, false in production
  console.log('VITE DEV:', import.meta.env.DEV);
  // true if Server-Side Rendering
  console.log('VITE SSR:', import.meta.env.SSR);

  // Your custom variables (prefixed with VITE_):
  console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);