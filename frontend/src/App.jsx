// App.jsx
import React, { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import AdminApp from './admin/adminApp.jsx';
import Layout from './components/layout';
import HomePage from './pages/HomePage';
import WelcomePage from './pages/WelcomePage';
import AccountSetupPage from './pages/AccountSetupPage';
import CharacterCreatePage from './pages/CharacterCreatePage';
import CharacterEditPage from './pages/CharacterEditPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import PublicProfilePage from "./pages/PublicProfilePage";
import SearchPage from "./pages/SearchPage";


export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    fetch(`/api/current-user`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setUser(data));
  }, []);

  if (user === undefined) return null;

  const router = createBrowserRouter([
    {
      path: '/',
      element: user ? <Layout /> : <WelcomePage setUser={setUser} />,
      children: user ? [
        { index: true, element: <HomePage /> },
        { path: 'character-create', element: <CharacterCreatePage /> },
        { path: 'character-edit', element: <CharacterEditPage /> },
        { path: 'chat', element: <ChatPage /> },
        { path: 'profile', element: <ProfilePage /> },
        { path: "profile/:userId", element: <PublicProfilePage /> },
        { path: "search", element: <SearchPage /> },
      ] : [],
    },
    {
      path: '/admin',
      element: <AdminApp />,
    },
    {
      path: '/account-setup',
      element: <AccountSetupPage />,
    }
  ]);

  return <RouterProvider router={router} />;
}
