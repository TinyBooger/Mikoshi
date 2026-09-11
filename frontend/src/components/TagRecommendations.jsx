import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthProvider';

const MAX_RECOMMENDATIONS = 6;

/**
 * Lightweight, client-side tag recommendations shared by the character, scene
 * and persona forms.
 *
 * It recommends existing tags whose name literally appears in `sourceText`
 * (the text the user has written so far). If fewer than MAX_RECOMMENDATIONS
 * match, the remaining slots are filled with the most-liked existing tags so
 * the row is never empty.
 *
 * Renders nothing until the tag list has loaded, when no tag is available, or
 * when the tag limit has been reached.
 */
export default function TagRecommendations({ currentTags = [], onAddTag, sourceText = [], maxTags }) {
  const { sessionToken } = useContext(AuthContext);
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${window.API_BASE_URL}/api/tags/all`, {
      headers: sessionToken ? { 'Authorization': sessionToken } : {},
    })
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (!cancelled && Array.isArray(data)) setAllTags(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sessionToken]);

  const likesByName = useMemo(() => {
    const map = new Map();
    for (const tag of allTags) {
      const name = String(tag.name || '').trim();
      if (name) map.set(name, Number(tag.likes) || 0);
    }
    return map;
  }, [allTags]);

  const recommendedTags = useMemo(() => {
    if (allTags.length === 0) return [];
    const picked = new Set(currentTags);
    const haystack = sourceText.filter(Boolean).join(' ').toLowerCase();

    const matched = [];
    for (const tag of allTags) {
      const name = String(tag.name || '').trim();
      if (!name || picked.has(name)) continue;
      const needle = name.toLowerCase();
      if (needle.length >= 2 && haystack.includes(needle)) matched.push(name);
    }
    if (matched.length >= MAX_RECOMMENDATIONS) return matched.slice(0, MAX_RECOMMENDATIONS);

    const popular = [...likesByName.keys()]
      .filter(name => !picked.has(name) && !matched.includes(name))
      .sort((a, b) => (likesByName.get(b) || 0) - (likesByName.get(a) || 0));
    return [...matched, ...popular].slice(0, MAX_RECOMMENDATIONS);
  }, [allTags, likesByName, currentTags, sourceText]);

  if (recommendedTags.length === 0) return null;
  if (Number.isFinite(maxTags) && currentTags.length >= maxTags) return null;

  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
      <span className="text-muted" style={{ fontSize: '0.82rem' }}>推荐：</span>
      {recommendedTags.map(tag => (
        <button
          key={tag}
          type="button"
          onClick={() => onAddTag(tag)}
          className="d-inline-flex align-items-center"
          style={{
            background: '#eef2ff',
            color: '#4f46e5',
            border: '1px solid #dbe2ea',
            borderRadius: 999,
            padding: '0.3rem 0.7rem',
            fontSize: '0.84rem',
            lineHeight: 1.2,
          }}
        >
          <i className="bi bi-plus me-1"></i>
          {tag}
        </button>
      ))}
    </div>
  );
}
