import React from 'react';
import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router';
import BrowsePage from './pages/BrowsePage.jsx';
import { AuthProvider } from './components/AuthProvider.jsx';
import Layout from './components/Layout.jsx';
import ToastProvider from './components/ToastProvider.jsx';
import './i18n.js';

export function renderLandingPage(initialBrowseData) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <BrowsePage initialData={initialBrowseData} /> },
      ],
    },
  ], { initialEntries: ['/'] });

  return renderToString(
    <React.StrictMode>
      <AuthProvider initialState={{ sessionToken: null, userData: null, loading: false }}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </React.StrictMode>
  );
}
