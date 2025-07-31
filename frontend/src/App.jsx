import React, { useContext, useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import AuthLayout from './components/AuthLayout';
import AdminApp from './admin/AdminApp.jsx';
import Layout from './components/layout';
import HomePage from './pages/HomePage';
import BrowsePage from './pages/BrowsePage.jsx';
import WelcomePage from './pages/WelcomePage';
import SignUpPage from './pages/SignUpPage';
import CharacterCreatePage from './pages/CharacterCreatePage';
import CharacterEditPage from './pages/CharacterEditPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from "./pages/SearchPage";
import { AuthContext } from './components/AuthProvider';
import DashboardPage from "./admin/pages/DashboardPage";
import UsersPage from "./admin/pages/UsersPage";
import CharactersPage from './admin/pages/CharactersPage.jsx';
import TagsPage from './admin/pages/TagsPage.jsx';
import SearchTermsPage from './admin/pages/SearchTermsPage.jsx';
import TestPage from './pages/TestPage.jsx';

export default function App() {
  const { currentUser, loading } = useContext(AuthContext);

  if (loading) {
    return null; // Or a loading spinner
  }

  const router = createBrowserRouter([
    currentUser
      ? {
          path: '/',
          element: <Layout />,
          children: [
            { index: true, element: <HomePage /> },
            { path: 'test', element: <TestPage /> },
            { path: 'browse/:category', element: <BrowsePage /> },
            { path: 'character-create', element: <CharacterCreatePage /> },
            { path: 'character-edit', element: <CharacterEditPage /> },
            { path: 'chat', element: <ChatPage /> },
            { path: 'profile', element: <ProfilePage /> },
            { path: 'profile/:userId', element: <ProfilePage publicView={true} /> },
            { path: 'search', element: <SearchPage /> },
          ],
        }
      : {
          path: '/',
          element: <AuthLayout />,
          children: [
            { index: true, element: <WelcomePage /> },
            { path: 'sign-up', element: <SignUpPage /> },
          ],
        },
    {
      path: '/admin',
      element: <AdminApp />,
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'users', element: <UsersPage /> },
        { path: 'characters', element: <CharactersPage /> },
        { path: 'tags', element: <TagsPage /> },
        { path: 'search-terms', element: <SearchTermsPage /> },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}