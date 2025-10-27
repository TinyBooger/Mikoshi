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
window.API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// Add this at the top of your App.js or main component
console.log('API_BASE_URL:', window.API_BASE_URL);
console.log('import.meta.env:', import.meta.env);
console.log('PROD:', import.meta.env.PROD);
console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);