import React, { useContext, useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import AuthLayout from './components/AuthLayout';
import AdminApp from './admin/AdminApp.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage';
import BrowsePage from './pages/BrowsePage.jsx';
import WelcomePage from './pages/WelcomePage';
import SignUpPage from './pages/SignUpPage';
import PersonaFormPage from './pages/PersonaFormPage';
import SceneFormPage from './pages/SceneFormPage';
import CharacterFormPage from './pages/CharacterFormPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage.jsx';
import SearchPage from "./pages/SearchPage";
import { AuthContext } from './components/AuthProvider';
import DashboardPage from "./admin/pages/DashboardPage";
import UsersPage from "./admin/pages/UsersPage";
import CharactersPage from './admin/pages/CharactersPage.jsx';
import TagsPage from './admin/pages/TagsPage.jsx';
import SearchTermsPage from './admin/pages/SearchTermsPage.jsx';
import InvitationCodesPage from './admin/pages/InvitationCodesPage.jsx';
import TestPage from './pages/TestPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import TermsOfServicePage from './pages/TermsOfServicePage.jsx';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx';

export default function App() {
  const { userData, loading } = useContext(AuthContext);

  if (loading) {
    return null; // Or a loading spinner
  }

  const router = createBrowserRouter([
    userData
      ? {
          path: '/',
          element: <Layout />,
          children: [
            { index: true, element: <HomePage /> },
            { path: 'test', element: <TestPage /> },
            { path: 'browse/:mainTab/:subTab', element: <BrowsePage /> },
            { path: 'browse/:mainTab', element: <BrowsePage /> },
            { path: 'character/create', element: <CharacterFormPage /> },
            { path: 'character/edit/:id', element: <CharacterFormPage /> },
            { path: 'persona/create', element: <PersonaFormPage /> },
            { path: 'persona/edit/:id', element: <PersonaFormPage /> },
            { path: 'scene/create', element: <SceneFormPage /> },
            { path: 'scene/edit/:id', element: <SceneFormPage /> },
            { path: 'chat', element: <ChatPage /> },
            { path: 'profile', element: <ProfilePage /> },
            { path: 'profile/:userId', element: <ProfilePage publicView={true} /> },
            { path: 'settings', element: <SettingsPage /> },
            { path: 'search', element: <SearchPage /> },
            { path: 'terms-of-service', element: <TermsOfServicePage /> },
            { path: 'privacy-policy', element: <PrivacyPolicyPage /> },
          ],
        }
      : {
          path: '/',
          element: <AuthLayout />,
          children: [
            { index: true, element: <WelcomePage /> },
            { path: 'sign-up', element: <SignUpPage /> },
            { path: 'reset-password', element: <ResetPasswordPage /> },
            { path: 'terms-of-service', element: <TermsOfServicePage /> },
            { path: 'privacy-policy', element: <PrivacyPolicyPage /> },
          ],
        },
    {
      path: '/admin',
      element: <AdminRoute><AdminApp /></AdminRoute>,
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'users', element: <UsersPage /> },
        { path: 'characters', element: <CharactersPage /> },
        { path: 'tags', element: <TagsPage /> },
        { path: 'search-terms', element: <SearchTermsPage /> },
        { path: 'invitations', element: <InvitationCodesPage /> },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}