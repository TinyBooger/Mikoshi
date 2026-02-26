import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { AuthProvider } from './components/AuthProvider';
import ToastProvider from './components/ToastProvider';
import { errorLogger } from './utils/errorLogger';

// Set global API base URL - this runs before any component code
const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
window.API_BASE_URL = envApiBaseUrl && envApiBaseUrl.trim() !== ""
  ? envApiBaseUrl
  : window.location.origin;

// Initialize error logging with global handlers
errorLogger.init();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);