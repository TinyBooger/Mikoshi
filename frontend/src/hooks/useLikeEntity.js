import { useState } from 'react';

/**
 * Like/unlike handling for characters, scenes and personas.
 *
 * The `hasLiked` map is also written by the entry/loading flows (they hydrate
 * it from the server response), so `setHasLiked` is returned alongside the
 * two action helpers.
 *
 * @param {object}   params
 * @param {string}   params.sessionToken - auth session token
 * @param {function} params.setLikes     - setter for the caller's like count
 * @returns {{ hasLiked, setHasLiked, likeEntity, unlikeEntity }}
 */
export function useLikeEntity({ sessionToken, setLikes }) {
  const [hasLiked, setHasLiked] = useState({ character: false, scene: false, persona: false });

  // Generic like function for character, scene, or persona
  const likeEntity = async (entityType, entityId) => {
    const res = await fetch(`${window.API_BASE_URL}/api/like/${entityType}/${entityId}`, {
      method: 'POST',
  headers: { 'Authorization': sessionToken }
    });
    if (res.ok) {
      const data = await res.json();
      setLikes(data.likes);
      setHasLiked(prev => ({ ...prev, [entityType]: true }));
    }
  };

  // Generic unlike function for character, scene, or persona
  const unlikeEntity = async (entityType, entityId) => {
    const res = await fetch(`${window.API_BASE_URL}/api/unlike/${entityType}/${entityId}`, {
      method: 'POST',
  headers: { 'Authorization': sessionToken }
    });
    if (res.ok) {
      const data = await res.json();
      setLikes(data.likes);
      setHasLiked(prev => ({ ...prev, [entityType]: false }));
    }
  };

  return { hasLiked, setHasLiked, likeEntity, unlikeEntity };
}
