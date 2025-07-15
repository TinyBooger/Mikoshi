// App.jsx
import React, { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import AdminApp from './admin/AdminApp.jsx';
import Layout from './components/layout';
import HomePage from './pages/HomePage';
import BrowsePage from './pages/BrowsePage.jsx';
import WelcomePage from './pages/WelcomePage';
import AccountSetupPage from './pages/AccountSetupPage';
import CharacterCreatePage from './pages/CharacterCreatePage';
import CharacterEditPage from './pages/CharacterEditPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import PublicProfilePage from "./pages/PublicProfilePage";
import SearchPage from "./pages/SearchPage";

import DashboardPage from "./admin/pages/DashboardPage";
import UsersPage from "./admin/pages/UsersPage";
import CharactersPage from './admin/pages/CharactersPage.jsx';
import TagsPage from './admin/pages/TagsPage.jsx';
import SearchTermsPage from './admin/pages/SearchTermsPage.jsx';

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
        { path: 'browse/:category', element: <BrowsePage /> },
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
      children: [
        {index: true, element: <DashboardPage />},
        {path: 'users', element: <UsersPage />},
        {path: 'characters', element: <CharactersPage />},
        {path: 'tags', element: <TagsPage />},
        {path: 'search-terms', element: <SearchTermsPage />},
      ]
    },
    {
      path: '/account-setup',
      element: <AccountSetupPage />,
    }
  ]);

  return <RouterProvider router={router} />;
}
