import { QueryClient } from '@tanstack/react-query';

// The query cache is in-memory only. Persisting the lists to localStorage made
// back-navigation marginally faster but could replay content that no longer
// exists server-side (a removed character reappearing from a previous visit),
// which is not a trade worth making for data the network answers fast.
// `staleTime` below keeps repeat navigation instant within a session.
const LEGACY_STORAGE_KEY = 'mikoshi.browseCache.v1';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45_000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Drops the blob written by older builds so it stops occupying storage.
export function clearLegacyQueryPersistence() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // storage unavailable; nothing to clean up
  }
}
