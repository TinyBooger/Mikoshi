import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { AuthProvider } from './components/AuthProvider';

// Set global API base URL - this runs before any component code
window.API_BASE_URL = import.meta.env.PROD
  ? 'https://chatbox-landing-page.onrender.com'  // Production
  : 'http://localhost:8000';                     // Development

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);