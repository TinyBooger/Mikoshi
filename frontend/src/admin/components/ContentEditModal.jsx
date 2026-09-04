import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../components/AuthProvider";

const TYPE_META = {
  character: { label: 'Character', apiBase: '/api/admin/characters' },
  scene: { label: 'Scene', apiBase: '/api/admin/scenes' },
  persona: { label: 'Persona', apiBase: '/api/admin/personas' },
};

const MODERATION_STATUS_BADGES = {
  restricted: { label: 'Restricted', cls: 'bg-warning text-dark' },
  takedown: { label: 'Takedown', cls: 'bg-danger' },
};

// Same sentinel the creator form uses for an AI-generated greeting option.
const IMPROVISE_SENTINEL = '[IMPROVISE_GREETING]';

const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/** Turn a stored media path (or full URL) into something <img> can load. */
const resolveMediaUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${window.API_BASE_URL.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
};

const buildEmptyForm = (contentType) => {
  const base = { tags: [], is_public: true, is_forkable: false };
  if (contentType === 'character') {
    return { ...base, name: '', tagline: '', persona: '', example_messages: '', greetings: [] };
  }
  if (contentType === 'scene') {
    return { ...base, name: '', intro: '', description: '', greeting: '' };
  }
  return { ...base, name: '', intro: '', description: '' };
};

/** Build the form object from a freshly fetched detail record. */
const formFromDetail = (contentType, d) => {
  const form = buildEmptyForm(contentType);
  form.name = d.name || '';
  form.is_public = !!d.is_public;
  form.is_forkable = !!d.is_forkable;
  form.tags = Array.isArray(d.tags) ? [...d.tags] : [];
  if (contentType === 'character') {
    form.tagline = d.tagline || '';
    form.persona = d.persona || '';
    form.example_messages = d.example_messages || '';
    form.greetings = Array.isArray(d.greetings)
      ? d.greetings.filter((g) => typeof g === 'string')
      : d.greeting
        ? [d.greeting]
        : [];
  } else if (contentType === 'scene') {
    form.intro = d.intro || '';
    form.description = d.description || '';
    form.greeting = d.greeting || '';
  } else {
    form.intro = d.intro || '';
    form.description = d.description || '';
  }
  return form;
};

/** Per-type editable field names that map 1:1 to the PATCH schema. */
const EDITABLE_FIELDS = {
  character: ['name', 'tagline', 'persona', 'example_messages', 'greetings', 'tags', 'is_public', 'is_forkable'],
  scene: ['name', 'intro', 'description', 'greeting', 'tags', 'is_public', 'is_forkable'],
  persona: ['name', 'intro', 'description', 'tags', 'is_public', 'is_forkable'],
};

/**
 * Simple tag editor: type + Enter (or comma) to add, x to remove,
 * backspace on an empty input removes the last tag.
 */
function TagEditor({ tags, onChange, disabled, id }) {
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const value = draft.trim().replace(/,$/, '');
    if (!value) return;
    if (!tags.includes(value)) onChange([...tags, value]);
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-2">
        {tags.map((tag, idx) => (
          <span key={`${tag}-${idx}`} className="badge rounded-pill text-bg-primary content-tag-chip">
            {tag}
            <button
              type="button"
              className="btn-close btn-close-white content-tag-remove"
              aria-label={`Remove ${tag}`}
              disabled={disabled}
              onClick={() => onChange(tags.filter((_, i) => i !== idx))}
            />
          </span>
        ))}
      </div>
      <input
        id={id}
        type="text"
        className="form-control"
        value={draft}
        disabled={disabled}
        placeholder={tags.length === 0 ? 'Type a tag and press Enter' : 'Add another tag…'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
      />
    </div>
  );
}

export default function ContentEditModal({ contentType, item, onClose, onContentUpdated }) {
  const { sessionToken } = useContext(AuthContext);
  const meta = TYPE_META[contentType] || TYPE_META.character;

  // `detail` is the live server record fetched on open; the list row `item`
  // only acts as a fallback (it lacks the editable content fields).
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [form, setForm] = useState(() => buildEmptyForm(contentType));
  const [formInit, setFormInit] = useState(false);
  const [pending, setPending] = useState(null); // 'save' | null
  const [notice, setNotice] = useState(null);

  const current = detail || item;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Fetch live content on open so the modal never edits stale/empty data.
  useEffect(() => {
    let cancelled = false;
    const fetchDetail = async () => {
      setLoadingDetail(true);
      setLoadError(null);
      try {
        const res = await fetch(`${window.API_BASE_URL}${meta.apiBase}/${item.id}`, {
          headers: { 'Authorization': sessionToken },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.detail || 'Failed to load content detail');
        }
        const data = await res.json();
        if (cancelled) return;
        setDetail(data);
        if (!formInit) {
          setForm(formFromDetail(contentType, data));
          setFormInit(true);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            'Could not load the live content. Editing is disabled — close and try again so content fields are not accidentally cleared.'
          );
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };
    fetchDetail();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, contentType, sessionToken]);

  // Auto-dismiss notices
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const showNotice = (type, text) => setNotice({ type, text });

  // Re-fetch the live record (used after a successful save).
  const refreshDetail = async () => {
    try {
      const res = await fetch(`${window.API_BASE_URL}${meta.apiBase}/${item.id}`, {
        headers: { 'Authorization': sessionToken },
      });
      if (!res.ok) return null;
      const data = await res.json();
      setDetail(data);
      return data;
    } catch (e) {
      return null;
    }
  };

  const setGreetingAt = (idx, value) => {
    const updated = [...form.greetings];
    updated[idx] = value;
    setField('greetings', updated);
  };

  const removeGreetingAt = (idx) => {
    setField('greetings', form.greetings.filter((_, i) => i !== idx));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!detail) return; // never save with a fallback-only form (risk of wiping content)

    if (!form.name.trim()) {
      showNotice('danger', 'Name is required');
      return;
    }
    if (contentType === 'character' && !form.persona.trim()) {
      showNotice('danger', 'Persona is required');
      return;
    }
    if (contentType === 'scene' && !form.description.trim()) {
      showNotice('danger', 'Description is required');
      return;
    }

    const payload = {};
    EDITABLE_FIELDS[contentType].forEach((key) => {
      const value = form[key];
      if (value === undefined || value === null) return;
      payload[key] = key === 'name' ? value.trim() : value;
    });

    setPending('save');
    try {
      const res = await fetch(`${window.API_BASE_URL}${meta.apiBase}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': sessionToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showNotice('danger', data?.detail || 'Failed to save changes');
        return;
      }
      // Optimistically patch the parent row + local detail…
      const merged = { ...current, ...payload, id: item.id };
      onContentUpdated(merged);
      // …then pull the authoritative record so the modal stays live.
      const fresh = await refreshDetail();
      if (fresh) onContentUpdated(fresh);
      showNotice('success', data?.message || 'Changes saved');
    } catch (err) {
      console.error(err);
      showNotice('danger', 'Failed to save changes');
    } finally {
      setPending(null);
    }
  };

  const previewSrc = detail ? resolveMediaUrl(detail.picture || detail.avatar_picture) : null;
  const isBusy = !!pending;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content content-edit-modal">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-pencil-square me-2" />
              Edit {meta.label}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>

          <div className="modal-body">
            {notice && (
              <div className={`alert alert-${notice.type} py-2 d-flex justify-content-between align-items-center`}>
                <span>{notice.text}</span>
                <button type="button" className="btn-close" onClick={() => setNotice(null)} aria-label="Dismiss" />
              </div>
            )}

            {loadError && !loadingDetail && (
              <div className="alert alert-warning py-2">
                <i className="bi bi-exclamation-triangle me-2" />
                {loadError}
              </div>
            )}

            {loadingDetail ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" />
                <div className="mt-2 text-muted">Loading live content…</div>
              </div>
            ) : (
              <>
                {/* ---------- Identity summary ---------- */}
                <div className="d-flex align-items-start gap-3 mb-4">
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt={current.name}
                      className="content-avatar"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div
                      className="content-avatar"
                      style={{
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '1.4rem',
                      }}
                    >
                      {(current.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div className="d-flex align-items-center flex-wrap gap-2">
                      <h5 className="mb-0">{current.name}</h5>
                      {current.is_public
                        ? <span className="badge bg-success">Public</span>
                        : <span className="badge bg-secondary">Private</span>}
                      {current.moderation_status && MODERATION_STATUS_BADGES[current.moderation_status] && (
                        <span className={`badge ${MODERATION_STATUS_BADGES[current.moderation_status].cls}`}>
                          {MODERATION_STATUS_BADGES[current.moderation_status].label}
                        </span>
                      )}
                      {current.appeal_under_review && (
                        <span className="badge bg-info text-dark">Appeal pending</span>
                      )}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                      <div>
                        {current.creator_name
                          ? <>By <strong>{current.creator_name}</strong></>
                          : <>Creator: {current.creator_id || 'unknown'}</>}
                        {' · '}Created {fmtDateTime(current.created_time)}
                      </div>
                      <div className="d-flex align-items-center flex-wrap gap-3" style={{ fontSize: '0.82rem' }}>
                        <span><i className="bi bi-hash me-1" />ID {current.id}</span>
                        <span><i className="bi bi-eye me-1" />{current.views ?? 0}</span>
                        <span><i className="bi bi-heart me-1" />{current.likes ?? 0}</span>
                        {current.forked_from_name && (
                          <span><i className="bi bi-diagram-2 me-1" />Fork of {current.forked_from_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ---------- Content fields ---------- */}
                <form onSubmit={handleSave}>
                  <div className="content-edit-section mb-4">
                    <h6 className="content-edit-section-title">
                      <i className="bi bi-pencil-square me-2 text-primary" />
                      Content
                    </h6>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Name <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          value={form.name}
                          disabled={isBusy}
                          onChange={(e) => setField('name', e.target.value)}
                        />
                      </div>

                      {contentType === 'character' && (
                        <div className="col-md-6">
                          <label className="form-label fw-semibold">Tagline</label>
                          <input
                            type="text"
                            className="form-control"
                            value={form.tagline}
                            disabled={isBusy}
                            onChange={(e) => setField('tagline', e.target.value)}
                          />
                        </div>
                      )}

                      {(contentType === 'scene' || contentType === 'persona') && (
                        <div className="col-md-6">
                          <label className="form-label fw-semibold">Intro</label>
                          <textarea
                            className="form-control"
                            rows={2}
                            value={form.intro}
                            disabled={isBusy}
                            onChange={(e) => setField('intro', e.target.value)}
                          />
                        </div>
                      )}

                      {contentType === 'character' && (
                        <div className="col-12">
                          <label className="form-label fw-semibold">
                            Persona <span className="text-danger">*</span>
                          </label>
                          <textarea
                            className="form-control"
                            rows={8}
                            required
                            value={form.persona}
                            disabled={isBusy}
                            onChange={(e) => setField('persona', e.target.value)}
                          />
                        </div>
                      )}

                      {(contentType === 'scene' || contentType === 'persona') && (
                        <div className="col-12">
                          <label className="form-label fw-semibold">
                            Description {contentType === 'scene' && <span className="text-danger">*</span>}
                          </label>
                          <textarea
                            className="form-control"
                            rows={6}
                            required={contentType === 'scene'}
                            value={form.description}
                            disabled={isBusy}
                            onChange={(e) => setField('description', e.target.value)}
                          />
                        </div>
                      )}

                      {contentType === 'character' && (
                        <div className="col-12">
                          <label className="form-label fw-semibold">Example Messages</label>
                          <textarea
                            className="form-control"
                            rows={4}
                            value={form.example_messages}
                            disabled={isBusy}
                            placeholder="Sample {{user}}/{{char}} dialogue shown to the model"
                            onChange={(e) => setField('example_messages', e.target.value)}
                          />
                        </div>
                      )}

                      {contentType === 'scene' && (
                        <div className="col-12">
                          <label className="form-label fw-semibold">Greeting</label>
                          <textarea
                            className="form-control"
                            rows={3}
                            value={form.greeting}
                            disabled={isBusy}
                            onChange={(e) => setField('greeting', e.target.value)}
                          />
                        </div>
                      )}

                      {contentType === 'character' && (
                        <div className="col-12">
                          <label className="form-label fw-semibold d-block">
                            Greetings
                            <small className="text-muted fw-normal ms-2">
                              {form.greetings.length} saved
                            </small>
                          </label>

                          {form.greetings.map((g, idx) => {
                            const isSentinel = g === IMPROVISE_SENTINEL;
                            return (
                              <div key={idx} className="d-flex gap-2 mb-2 align-items-start">
                                <span
                                  className="content-greeting-index"
                                  style={{ minWidth: 26, textAlign: 'right', marginTop: 8 }}
                                >
                                  #{idx + 1}
                                </span>
                                <textarea
                                  className="form-control"
                                  rows={isSentinel ? 1 : 3}
                                  value={g}
                                  readOnly={isSentinel}
                                  disabled={isBusy}
                                  onChange={(e) => setGreetingAt(idx, e.target.value)}
                                />
                                {isSentinel && (
                                  <span className="badge bg-info text-dark mt-2" style={{ whiteSpace: 'nowrap' }}>
                                    <i className="bi bi-magic me-1" />AI-generated
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm"
                                  disabled={isBusy}
                                  title="Remove greeting"
                                  onClick={() => removeGreetingAt(idx)}
                                >
                                  <i className="bi bi-trash" />
                                </button>
                              </div>
                            );
                          })}

                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            disabled={isBusy}
                            onClick={() => setField('greetings', [...form.greetings, ''])}
                          >
                            <i className="bi bi-plus-lg me-1" />
                            Add Greeting
                          </button>
                          {form.greetings.length === 0 && (
                            <div className="text-muted mt-1" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
                              No greetings saved. Each row is one opening message the character can start with.
                            </div>
                          )}
                        </div>
                      )}

                      <div className="col-12">
                        <label className="form-label fw-semibold d-block">Tags</label>
                        <TagEditor
                          id={`content-tags-${item.id}`}
                          tags={form.tags}
                          disabled={isBusy}
                          onChange={(tags) => setField('tags', tags)}
                        />
                      </div>

                      <div className="col-md-6">
                        <div className="form-check form-switch">
                          <input
                            id="content-edit-is-public"
                            type="checkbox"
                            className="form-check-input"
                            role="switch"
                            checked={form.is_public}
                            disabled={isBusy}
                            onChange={(e) => setField('is_public', e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="content-edit-is-public">
                            Public
                          </label>
                        </div>
                        <small className="text-muted d-block">Visible in discovery for everyone.</small>
                      </div>

                      <div className="col-md-6">
                        <div className="form-check form-switch">
                          <input
                            id="content-edit-is-forkable"
                            type="checkbox"
                            className="form-check-input"
                            role="switch"
                            checked={form.is_forkable}
                            disabled={isBusy}
                            onChange={(e) => setField('is_forkable', e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="content-edit-is-forkable">
                            Forkable
                          </label>
                        </div>
                        <small className="text-muted d-block">Others may copy and build on this.</small>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={isBusy}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isBusy || !detail}
                      title={!detail ? 'Loading disabled until live content is fetched' : undefined}
                    >
                      {pending === 'save' && <span className="spinner-border spinner-border-sm me-2" />}
                      Save Changes
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
