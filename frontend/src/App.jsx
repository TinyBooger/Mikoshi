// App.jsx
import React, { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import Layout from './components/layout';
import HomePage from './pages/HomePage';
import WelcomePage from './pages/WelcomePage';

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/current-user`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setUser(data));
  }, []);

  if (user === undefined) return null;

  const router = createBrowserRouter([
    {
      path: '/',
      element: user ? <Layout /> : <WelcomePage setUser={setUser} />,
      children: user ? [{ index: true, element: <HomePage /> }] : [],
    },
  ]);

  return <RouterProvider router={router} />;
}
