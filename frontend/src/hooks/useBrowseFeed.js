import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { buildQuery, fetchJson } from '../lib/apiClient';

// Public lists are fetched without a token so the response is identical for
// every viewer and can be cached by Redis / nginx. Personal flags come from
// useInteractions instead, as a thin overlay.
const PUBLIC_LIST = 'public-list';
const FOLLOWING_FEED = 'following-feed';
const PAGE_SIZE = 20;
const PERSONAL_TABS = new Set(['users']);

function listPath(tab, sub, page) {
  if (tab === 'users') {
    return `/api/users/browse?${buildQuery({ sort: sub, page, page_size: PAGE_SIZE })}`;
  }
  return `/api/${tab}/${sub}?${buildQuery({ short: 'false', page, page_size: PAGE_SIZE })}`;
}

function normalizePage(payload, page) {
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length, page, pageSize: PAGE_SIZE, hasMore: false };
  }
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = payload?.total || 0;
  const pageSize = payload?.page_size || PAGE_SIZE;
  return {
    items,
    total,
    page,
    pageSize,
    hasMore: total > 0 ? page * pageSize < total : items.length >= pageSize,
  };
}

function requireAuth(tab, sub) {
  return PERSONAL_TABS.has(tab) || sub === 'recommended';
}

export function useBrowseFeed({ tab, sub, token }) {
  const needsAuth = requireAuth(tab, sub);
  // Personal lists must not be shared between two accounts on the same browser,
  // so only those keys carry the viewer.
  const queryKey = needsAuth
    ? [PUBLIC_LIST, tab, sub, token || 'anon']
    : [PUBLIC_LIST, tab, sub];

  const query = useInfiniteQuery({
    queryKey,
    enabled: Boolean(token) || !needsAuth,
    placeholderData: keepPreviousData,
    staleTime: 45_000,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchJson(listPath(tab, sub, pageParam), {
        token: needsAuth ? token : undefined,
        signal,
      }).then((payload) => normalizePage(payload, pageParam)),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      const hasMore = lastPage.total > 0 ? loaded < lastPage.total : lastPage.hasMore;
      return hasMore && lastPage.items.length > 0 ? pages.length + 1 : undefined;
    },
  });

  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data]
  );
  const lastPage = query.data?.pages?.[query.data.pages.length - 1];

  return {
    items,
    total: lastPage?.total ?? 0,
    isLoading: query.isPending,
    isLoadingMore: query.isFetchingNextPage,
    hasMore: Boolean(query.hasNextPage),
    isError: query.isError,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
    reload: () => query.refetch(),
  };
}

export function useFollowingFeed({ token, enabled = true }) {
  const query = useInfiniteQuery({
    queryKey: [FOLLOWING_FEED, token || 'anon'],
    enabled: Boolean(enabled && token),
    staleTime: 45_000,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchJson(`/api/following/feed?${buildQuery({ page: pageParam, page_size: PAGE_SIZE })}`, {
        token,
        signal,
      }).then((payload) => normalizePage(payload, pageParam)),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      const hasMore = lastPage.total > 0 ? loaded < lastPage.total : lastPage.hasMore;
      return hasMore && lastPage.items.length > 0 ? pages.length + 1 : undefined;
    },
  });

  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data]
  );

  return {
    items,
    isLoading: query.isPending,
    isLoadingMore: query.isFetchingNextPage,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
  };
}
