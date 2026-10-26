// Intent-based code-split prefetching. A single delegated listener covers every
// link in the app, so navigation feels instant without eagerly shipping the
// chat / editor / admin bundles.
const PREFETCH_ROUTES = [
  { test: /^\/chat$/, load: () => import('../pages/ChatPage.jsx') },
  { test: /^\/search$/, load: () => import('../pages/SearchPage.jsx') },
  { test: /^\/(character|persona|scene)\/create$/, load: () => import('../pages/EntityFormPage.jsx') },
  { test: /^\/character\/(edit|fork)\//, load: () => import('../pages/CharacterFormPage.jsx') },
  { test: /^\/(persona|scene)\/(edit|fork)\//, load: () => import('../pages/EntityFormPage.jsx') },
  { test: /^\/profile(\/|$)/, load: () => import('../pages/ProfilePage.jsx') },
  { test: /^\/settings$/, load: () => import('../pages/SettingsPage.jsx') },
  { test: /^\/pro-upgrade$/, load: () => import('../pages/ProUpgradePage.jsx') },
  { test: /^\/credit-topup$/, load: () => import('../pages/CreditTopUpPage.jsx') },
  { test: /^\/admin(\/|$)/, load: () => import('../admin/AdminApp.jsx') },
  { test: /^\/[^/]+\/[^/]+$/, load: () => import('../pages/EntityDetailPage.jsx') },
];

const requested = new Set();

export function prefetchRoute(pathname) {
  if (!pathname) return;
  PREFETCH_ROUTES.forEach(({ test, load }) => {
    if (!test.test(pathname) || requested.has(pathname)) return;
    requested.add(pathname);
    load().catch(() => {
      requested.delete(pathname);
    });
  });
}

export function installIntentPrefetch() {
  const handleIntent = (event) => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    try {
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      prefetchRoute(url.pathname);
    } catch {
      // ignore malformed hrefs
    }
  };

  document.addEventListener('pointerover', handleIntent, { passive: true });
  document.addEventListener('touchstart', handleIntent, { passive: true });
  document.addEventListener('focusin', handleIntent);
}
