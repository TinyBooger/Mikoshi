import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildQuery, fetchJson } from '../lib/apiClient';

// Personal overlay on top of the cached public browse lists. Nothing here may
// affect layout: it only flips heart / follow flags and small counters.
const INTERACTIONS = 'interactions';
const PUBLIC_LIST = 'public-list';
const FOLLOWING_FEED = 'following-feed';

const LIKED_PARAM = {
  character: 'character_ids',
  scene: 'scene_ids',
  persona: 'persona_ids',
};

function serializeIds(ids) {
  if (!ids || ids.length === 0) return '';
  const unique = Array.from(new Set(ids.map(Number).filter(Number.isFinite)));
  unique.sort((a, b) => a - b);
  return unique.join(',');
}

export function useLikedQuery(type, ids, { token, enabled = true } = {}) {
  const idsParam = useMemo(() => serializeIds(ids), [ids]);
  return useQuery({
    queryKey: [INTERACTIONS, 'liked', type, idsParam, token || 'anon'],
    enabled: Boolean(enabled && token && idsParam),
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      fetchJson(`/api/me/interactions?${buildQuery({ [LIKED_PARAM[type]]: idsParam })}`, {
        token,
        signal,
      }).then((payload) => payload?.liked?.[type] ?? []),
  });
}

export function useLikedIds(type, ids, options = {}) {
  const { data } = useLikedQuery(type, ids, options);
  return useMemo(() => new Set(data || []), [data]);
}

// `ready` distinguishes "not liked" from "we do not know yet", so cards keep
// their server-rendered state until the overlay actually arrives.
export function useLikedOverlay(type, ids, options = {}) {
  const { data, isError } = useLikedQuery(type, ids, options);
  return useMemo(
    () => ({ likedIds: new Set(data || []), ready: data !== undefined || isError }),
    [data, isError]
  );
}

export function useFollowingIds({ token, enabled = true } = {}) {
  const { data } = useQuery({
    queryKey: [INTERACTIONS, 'following', token || 'anon'],
    enabled: Boolean(enabled && token),
    staleTime: 60_000,
    queryFn: ({ signal }) =>
      fetchJson('/api/me/interactions?include_following=true', { token, signal }).then(
        (payload) => payload?.following_ids ?? []
      ),
  });

  return useMemo(() => new Set(data || []), [data]);
}

function setLikedInCache(queryClient, type, id, liked) {
  queryClient.setQueriesData({ queryKey: [INTERACTIONS, 'liked', type] }, (current) => {
    const list = Array.isArray(current) ? current : [];
    const has = list.includes(id);
    if (liked && !has) return [...list, id];
    if (!liked && has) return list.filter((value) => value !== id);
    return list;
  });
}

function setFollowingInCache(queryClient, token, creatorId, following) {
  queryClient.setQueryData([INTERACTIONS, 'following', token || 'anon'], (current) => {
    const list = Array.isArray(current) ? current : [];
    const has = list.includes(creatorId);
    if (following && !has) return [...list, creatorId];
    if (!following && has) return list.filter((value) => value !== creatorId);
    return list;
  });
}

function adjustLikeCount(queryClient, type, id, delta) {
  const tab = `${type}s`;
  const patch = (current) => {
    if (!current?.pages) return current;
    let changed = false;
    const pages = current.pages.map((page) => {
      if (!Array.isArray(page?.items)) return page;
      let pageChanged = false;
      const items = page.items.map((item) => {
        const sameType = item?.type ? item.type === type : true;
        if (!sameType || String(item?.id) !== String(id)) return item;
        pageChanged = true;
        return { ...item, likes: Math.max(0, (item.likes || 0) + delta) };
      });
      if (!pageChanged) return page;
      changed = true;
      return { ...page, items };
    });
    return changed ? { ...current, pages } : current;
  };

  queryClient.setQueriesData({ queryKey: [PUBLIC_LIST, tab] }, patch);
  queryClient.setQueriesData({ queryKey: [FOLLOWING_FEED] }, patch);
}

export function useLikeToggle(type, token) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, nextLiked }) =>
      fetchJson(`/api/${nextLiked ? 'like' : 'unlike'}/${type}/${id}`, {
        method: 'POST',
        token,
      }),
    onMutate: async ({ id, nextLiked }) => {
      await queryClient.cancelQueries({ queryKey: [INTERACTIONS, 'liked', type] });
      setLikedInCache(queryClient, type, id, nextLiked);
      adjustLikeCount(queryClient, type, id, nextLiked ? 1 : -1);
      return { id, nextLiked };
    },
    onError: (error, variables) => {
      // 400 "already liked"/"not liked" means the server already matches the
      // desired state, so the optimistic value stands.
      if (error?.status === 400) return;
      setLikedInCache(queryClient, type, variables.id, !variables.nextLiked);
      adjustLikeCount(queryClient, type, variables.id, variables.nextLiked ? -1 : 1);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [INTERACTIONS, 'liked', type] });
    },
  });
}

export function useFollowToggle(token) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ creatorId, nextFollowing }) =>
      fetchJson(`/api/users/${encodeURIComponent(creatorId)}/follow`, {
        method: nextFollowing ? 'POST' : 'DELETE',
        token,
      }),
    onMutate: async ({ creatorId, nextFollowing }) => {
      await queryClient.cancelQueries({ queryKey: [INTERACTIONS, 'following'] });
      setFollowingInCache(queryClient, token, creatorId, nextFollowing);
      return { creatorId, nextFollowing };
    },
    onError: (error, variables) => {
      if (error?.status === 400) return;
      setFollowingInCache(queryClient, token, variables.creatorId, !variables.nextFollowing);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [INTERACTIONS, 'following'] });
    },
  });
}
