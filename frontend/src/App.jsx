import React, { useContext } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import AuthLayout from './components/AuthLayout';
import AdminApp from './admin/AdminApp.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage';
import BrowsePage from './pages/BrowsePage.jsx';
import WelcomePage from './pages/WelcomePage';
import SignUpPage from './pages/SignUpPage';
import EntityFormPage from './pages/EntityFormPage';
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
import ProblemReportsPage from './admin/pages/ProblemReportsPage.jsx';
import NotificationsPage from './admin/pages/NotificationsPage.jsx';
import ErrorLogsPage from './admin/pages/ErrorLogsPage.jsx';
import AuditLogsPage from './admin/pages/AuditLogsPage.jsx';
import UserStatsPage from './admin/pages/UserStatsPage.jsx';
import TestPage from './pages/TestPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import TermsOfServicePage from './pages/TermsOfServicePage.jsx';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx';
import EntityDetailPage from './pages/EntityDetailPage.jsx';
import AlipayTestPage from './pages/AlipayTestPage.jsx';
import AlipayReturnPage from './pages/AlipayReturnPage.jsx';
import ProUpgradePage from './pages/ProUpgradePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function AppRootLayout() {
  const { userData } = useContext(AuthContext);
  return userData ? <Layout /> : <AuthLayout />;
}

function ProtectedPage({ children }) {
  const { userData } = useContext(AuthContext);
  return userData ? children : <Navigate to="/" replace />;
}

function PublicOnlyPage({ children }) {
  const { userData } = useContext(AuthContext);
  return userData ? <Navigate to="/browse" replace /> : children;
}

function RootIndexPage() {
  const { userData } = useContext(AuthContext);
  return userData ? <Navigate to="/browse" replace /> : <WelcomePage />;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppRootLayout />,
    children: [
      { index: true, element: <RootIndexPage /> },
      { path: 'test', element: <ProtectedPage><TestPage /></ProtectedPage> },
      { path: 'browse', element: <ProtectedPage><BrowsePage /></ProtectedPage> },
      { path: 'browse/:mainTab/:subTab', element: <ProtectedPage><BrowsePage /></ProtectedPage> },
      { path: 'browse/:mainTab', element: <ProtectedPage><BrowsePage /></ProtectedPage> },
      { path: 'HomePage', element: <ProtectedPage><HomePage /></ProtectedPage> },
      { path: 'character/create', element: <ProtectedPage><CharacterFormPage /></ProtectedPage> },
      { path: 'character/edit/:id', element: <ProtectedPage><CharacterFormPage /></ProtectedPage> },
      { path: 'character/fork/:id', element: <ProtectedPage><CharacterFormPage /></ProtectedPage> },
      { path: 'persona/create', element: <ProtectedPage><EntityFormPage /></ProtectedPage> },
      { path: 'persona/edit/:id', element: <ProtectedPage><EntityFormPage /></ProtectedPage> },
      { path: 'persona/fork/:id', element: <ProtectedPage><EntityFormPage /></ProtectedPage> },
      { path: 'scene/create', element: <ProtectedPage><EntityFormPage /></ProtectedPage> },
      { path: 'scene/edit/:id', element: <ProtectedPage><EntityFormPage /></ProtectedPage> },
      { path: 'scene/fork/:id', element: <ProtectedPage><EntityFormPage /></ProtectedPage> },
      { path: ':type/:id', element: <ProtectedPage><EntityDetailPage /></ProtectedPage> },
      { path: 'chat', element: <ProtectedPage><ChatPage /></ProtectedPage> },
      { path: 'profile', element: <ProtectedPage><ProfilePage /></ProtectedPage> },
      { path: 'profile/:userId', element: <ProtectedPage><ProfilePage publicView={true} /></ProtectedPage> },
      { path: 'settings', element: <ProtectedPage><SettingsPage /></ProtectedPage> },
      { path: 'search', element: <ProtectedPage><SearchPage /></ProtectedPage> },
      { path: 'alipay/test', element: <ProtectedPage><AlipayTestPage /></ProtectedPage> },
      { path: 'alipay/return', element: <ProtectedPage><AlipayReturnPage /></ProtectedPage> },
      { path: 'pro-upgrade', element: <ProtectedPage><ProUpgradePage /></ProtectedPage> },
      { path: 'sign-up', element: <PublicOnlyPage><SignUpPage /></PublicOnlyPage> },
      { path: 'reset-password', element: <PublicOnlyPage><ResetPasswordPage /></PublicOnlyPage> },
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
      { path: 'problem-reports', element: <ProblemReportsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'error-logs', element: <ErrorLogsPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: 'user-stats', element: <UserStatsPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export default function App() {
  const { loading } = useContext(AuthContext);

  if (loading) {
    return null; // Or a loading spinner
  }

  return <RouterProvider router={router} />;
}