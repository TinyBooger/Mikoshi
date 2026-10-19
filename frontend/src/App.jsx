import React, { createContext, lazy, Suspense, useContext, useMemo, useRef } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router';
import AdminRoute from './components/AdminRoute.jsx';
import Layout from './components/Layout.jsx';
import BrowsePage from './pages/BrowsePage.jsx';
import { AuthContext } from './components/AuthProvider';

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const SignUpPage = lazy(() => import('./pages/SignUpPage.jsx'));
const EntityFormPage = lazy(() => import('./pages/EntityFormPage.jsx'));
const CharacterFormPage = lazy(() => import('./pages/CharacterFormPage.jsx'));
const ChatPage = lazy(() => import('./pages/ChatPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage.jsx'));
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'));
const DashboardPage = lazy(() => import('./admin/pages/DashboardPage.jsx'));
const UsersPage = lazy(() => import('./admin/pages/UsersPage.jsx'));
const ContentManagementPage = lazy(() => import('./admin/pages/ContentManagementPage.jsx'));
const TagsPage = lazy(() => import('./admin/pages/TagsPage.jsx'));
const SearchTermsPage = lazy(() => import('./admin/pages/SearchTermsPage.jsx'));
const ProblemReportsPage = lazy(() => import('./admin/pages/ProblemReportsPage.jsx'));
const ModerationPage = lazy(() => import('./admin/pages/ModerationPage.jsx'));
const NotificationsPage = lazy(() => import('./admin/pages/NotificationsPage.jsx'));
const UserMessagesPage = lazy(() => import('./admin/pages/UserMessagesPage.jsx'));
const ErrorLogsPage = lazy(() => import('./admin/pages/ErrorLogsPage.jsx'));
const AuditLogsPage = lazy(() => import('./admin/pages/AuditLogsPage.jsx'));
const UserStatsPage = lazy(() => import('./admin/pages/UserStatsPage.jsx'));
const SystemSettingsPage = lazy(() => import('./admin/pages/SystemSettingsPage.jsx'));
const TestPage = lazy(() => import('./pages/TestPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage.jsx'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage.jsx'));
const EntityDetailPage = lazy(() => import('./pages/EntityDetailPage.jsx'));
const AlipayTestPage = lazy(() => import('./pages/AlipayTestPage.jsx'));
const PaymentReturnPage = lazy(() => import('./pages/PaymentReturnPage.jsx'));
const ProUpgradePage = lazy(() => import('./pages/ProUpgradePage.jsx'));
const ProUpgradePaymentPage = lazy(() => import('./pages/ProUpgradePaymentPage.jsx'));
const CreditTopUpPage = lazy(() => import('./pages/CreditTopUpPage.jsx'));
const PackagePaymentPage = lazy(() => import('./pages/PackagePaymentPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

export const InitialBrowseDataContext = createContext(null);

function RouteLoadingFallback() {
  return (
    <div className="d-flex justify-content-center align-items-center p-4" role="status">
      <span className="spinner-border spinner-border-sm text-secondary" />
      <span className="visually-hidden">Loading page</span>
    </div>
  );
}

function LazyPage({ Component, ...props }) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Component {...props} />
    </Suspense>
  );
}

function AppRootLayout() {
  const { loading } = useContext(AuthContext);
  if (loading) {
    return null; // Or a loading spinner
  }
  // Always render Layout so unauthenticated users can browse the site
  return <Layout />;
}

function ProtectedPage({ children }) {
  const { userData, loading } = useContext(AuthContext);
  const location = useLocation();
  if (loading) return null; // or a spinner if you prefer
  return userData ? children : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}

function PublicOnlyPage({ children }) {
  const { userData, loading } = useContext(AuthContext);
  const location = useLocation();
  const initialized = useRef(false);

  if (!loading) initialized.current = true;
  if (!initialized.current) return null;

  return userData
    ? <Navigate to={location.state?.from || '/browse'} replace />
    : children;
}

function RootIndexPage() {
  const { userData, loading } = useContext(AuthContext);
  const initialBrowseData = useContext(InitialBrowseDataContext);
  if (loading) return null; // or a spinner if you prefer
  // Show BrowsePage as landing page for unauthenticated users
  return userData ? <Navigate to="/browse" replace /> : <BrowsePage initialData={initialBrowseData} />;
}

function KeyedChatPage() {
  const location = useLocation();
  const characterKey = new URLSearchParams(location.search).get('character') ?? 'no-character';
  return <ChatPage key={characterKey} />;
}

export const routes = [
  {
    path: '/',
    element: <AppRootLayout />,
    children: [
      { index: true, element: <RootIndexPage /> },
      { path: 'test', element: <ProtectedPage><LazyPage Component={TestPage} /></ProtectedPage> },
      { path: 'browse', element: <BrowsePage /> },
      { path: 'browse/:mainTab/:subTab', element: <BrowsePage /> },
      { path: 'browse/:mainTab', element: <BrowsePage /> },
      { path: 'character/create', element: <ProtectedPage><LazyPage Component={CharacterFormPage} /></ProtectedPage> },
      { path: 'character/edit/:id', element: <ProtectedPage><LazyPage Component={CharacterFormPage} /></ProtectedPage> },
      { path: 'character/fork/:id', element: <ProtectedPage><LazyPage Component={CharacterFormPage} /></ProtectedPage> },
      { path: 'persona/create', element: <ProtectedPage><LazyPage Component={EntityFormPage} /></ProtectedPage> },
      { path: 'persona/edit/:id', element: <ProtectedPage><LazyPage Component={EntityFormPage} /></ProtectedPage> },
      { path: 'persona/fork/:id', element: <ProtectedPage><LazyPage Component={EntityFormPage} /></ProtectedPage> },
      { path: 'scene/create', element: <ProtectedPage><LazyPage Component={EntityFormPage} /></ProtectedPage> },
      { path: 'scene/edit/:id', element: <ProtectedPage><LazyPage Component={EntityFormPage} /></ProtectedPage> },
      { path: 'scene/fork/:id', element: <ProtectedPage><LazyPage Component={EntityFormPage} /></ProtectedPage> },
      { path: ':type/:id', element: <ProtectedPage><LazyPage Component={EntityDetailPage} /></ProtectedPage> },
      { path: 'chat', element: <ProtectedPage><LazyPage Component={KeyedChatPage} /></ProtectedPage> },
      { path: 'profile', element: <ProtectedPage><LazyPage Component={ProfilePage} /></ProtectedPage> },
      { path: 'profile/:userId', element: <ProtectedPage><LazyPage Component={ProfilePage} publicView={true} /></ProtectedPage> },
      { path: 'settings', element: <ProtectedPage><LazyPage Component={SettingsPage} /></ProtectedPage> },
      { path: 'order/:orderId', element: <ProtectedPage><LazyPage Component={OrderDetailPage} /></ProtectedPage> },
      { path: 'search', element: <ProtectedPage><LazyPage Component={SearchPage} /></ProtectedPage> },
      { path: 'alipay/test', element: <ProtectedPage><LazyPage Component={AlipayTestPage} /></ProtectedPage> },
      { path: 'payment/return', element: <ProtectedPage><LazyPage Component={PaymentReturnPage} /></ProtectedPage> },
      { path: 'alipay/return', element: <ProtectedPage><LazyPage Component={PaymentReturnPage} /></ProtectedPage> },
      { path: 'pro-upgrade', element: <ProtectedPage><LazyPage Component={ProUpgradePage} /></ProtectedPage> },
      { path: 'pro-upgrade/payment', element: <ProtectedPage><LazyPage Component={ProUpgradePaymentPage} /></ProtectedPage> },
      { path: 'pro-upgrade/payment/package', element: <ProtectedPage><LazyPage Component={PackagePaymentPage} /></ProtectedPage> },
      { path: 'credit-topup', element: <ProtectedPage><LazyPage Component={CreditTopUpPage} /></ProtectedPage> },
    ],
  },
  {
    path: '/login',
    element: <PublicOnlyPage><LazyPage Component={LoginPage} /></PublicOnlyPage>,
  },
  {
    path: '/sign-up',
    element: <PublicOnlyPage><LazyPage Component={SignUpPage} /></PublicOnlyPage>,
  },
  {
    path: '/reset-password',
    element: <PublicOnlyPage><LazyPage Component={ResetPasswordPage} /></PublicOnlyPage>,
  },
  {
    path: '/terms-of-service',
    element: <LazyPage Component={TermsOfServicePage} />,
  },
  {
    path: '/privacy-policy',
    element: <LazyPage Component={PrivacyPolicyPage} />,
  },
  {
    path: '/admin',
    element: <Suspense fallback={<RouteLoadingFallback />}><AdminRoute><AdminApp /></AdminRoute></Suspense>,
    children: [
      { index: true, element: <LazyPage Component={DashboardPage} /> },
      { path: 'users', element: <LazyPage Component={UsersPage} /> },
      { path: 'content', element: <LazyPage Component={ContentManagementPage} /> },
      { path: 'tags', element: <LazyPage Component={TagsPage} /> },
      { path: 'search-terms', element: <LazyPage Component={SearchTermsPage} /> },
      { path: 'problem-reports', element: <LazyPage Component={ProblemReportsPage} /> },
      { path: 'moderation', element: <LazyPage Component={ModerationPage} /> },
      { path: 'notifications', element: <LazyPage Component={NotificationsPage} /> },
      { path: 'user-messages', element: <LazyPage Component={UserMessagesPage} /> },
      { path: 'error-logs', element: <LazyPage Component={ErrorLogsPage} /> },
      { path: 'audit-logs', element: <LazyPage Component={AuditLogsPage} /> },
      { path: 'user-stats', element: <LazyPage Component={UserStatsPage} /> },
      { path: 'system-settings', element: <LazyPage Component={SystemSettingsPage} /> },
    ],
  },
  {
    path: '*',
    element: <LazyPage Component={NotFoundPage} />,
  },
];

export default function App({ router: suppliedRouter, initialBrowseData = null }) {
  const router = useMemo(
    () => suppliedRouter || createBrowserRouter(routes),
    [suppliedRouter]
  );

  return (
    <InitialBrowseDataContext.Provider value={initialBrowseData}>
      <RouterProvider router={router} />
    </InitialBrowseDataContext.Provider>
  );
}