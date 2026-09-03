import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../components/AuthProvider";

const GRANT_PRESETS = [
  { months: 1, label: '1 Month' },
  { months: 3, label: '3 Months' },
  { months: 6, label: '6 Months' },
  { months: 12, label: '12 Months' },
];

const BAN_TYPE_LABELS = {
  upload_ban: { label: 'Upload Ban', cls: 'bg-warning text-dark' },
  full_ban: { label: 'Full Ban', cls: 'bg-danger' },
  shadow_ban: { label: 'Shadow Ban', cls: 'bg-secondary' },
};

const fmtDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const fmtDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/** Advance by calendar months, clamping overflow to the last day (matches backend _add_months). */
function addMonthsClamped(base, months) {
  const d = new Date(base);
  const origDay = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== origDay) d.setDate(0);
  return d;
}

export default function UserEditModal({ user, onClose, onUserUpdated }) {
  const { sessionToken, userData } = useContext(AuthContext);

  // `detail` is the fresh server response; the row object `user` is only a fallback.
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Profile form
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone_number || '');
  const [bio, setBio] = useState(user.bio || '');
  const [isAdmin, setIsAdmin] = useState(!!user.is_admin);
  const [formInit, setFormInit] = useState(false);

  // Pro grant
  const [selectedMonths, setSelectedMonths] = useState(null);

  // Busy flags: 'grant' | 'revoke' | 'profile' | null
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState(null);

  const current = detail || user;

  // Fetch the user's live status on open (the whole point of the redesign).
  useEffect(() => {
    let cancelled = false;
    const fetchDetail = async () => {
      setLoadingDetail(true);
      setLoadError(null);
      try {
        const res = await fetch(`${window.API_BASE_URL}/api/admin/users/${user.id}`, {
          headers: { 'Authorization': sessionToken },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.detail || 'Failed to load user detail');
        }
        const data = await res.json();
        if (cancelled) return;
        setDetail(data);
        if (!formInit) {
          setName(data.name || '');
          setPhone(data.phone_number || '');
          setBio(data.bio || '');
          setIsAdmin(!!data.is_admin);
          setFormInit(true);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError('Could not load live user data — showing the latest info from the list.');
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };
    fetchDetail();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, sessionToken]);

  // Auto-dismiss notices
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Re-fetch detail after any successful mutation so the modal and the list stay live.
  const refreshDetail = async () => {
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/admin/users/${user.id}`, {
        headers: { 'Authorization': sessionToken },
      });
      if (!res.ok) return null;
      const data = await res.json();
      setDetail(data);
      onUserUpdated(data);
      return data;
    } catch (e) {
      return null;
    }
  };

  const showNotice = (type, text) => setNotice({ type, text });

  const proActive = current.pro_status === 'active';
  const proExpired = current.pro_status === 'expired';
  const isSelf = userData && userData.id === user.id;

  const grantButtonLabel = useMemo(() => {
    if (!selectedMonths) return 'Select a duration above';
    return proActive
      ? `Extend by ${selectedMonths} Month${selectedMonths > 1 ? 's' : ''}`
      : `Grant ${selectedMonths} Month${selectedMonths > 1 ? 's' : ''}`;
  }, [selectedMonths, proActive]);

  const previewDate = useMemo(() => {
    if (!selectedMonths) return null;
    const base = proActive && current.pro_expire_date
      ? new Date(current.pro_expire_date)
      : new Date();
    if (Number.isNaN(base.getTime())) return null;
    return addMonthsClamped(base, selectedMonths);
  }, [selectedMonths, proActive, current.pro_expire_date]);

  const handleGrant = async () => {
    if (!selectedMonths) return;
    setPending('grant');
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/admin/users/${user.id}/grant-pro`, {
        method: 'POST',
        headers: { 'Authorization': sessionToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: selectedMonths }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showNotice('danger', data?.detail || 'Failed to grant Pro');
        return;
      }
      if (data?.user) {
        setDetail(data.user);
        onUserUpdated(data.user);
      } else {
        await refreshDetail();
      }
      showNotice('success', data?.message || 'Pro granted');
    } catch (e) {
      showNotice('danger', 'Failed to grant Pro');
    } finally {
      setPending(null);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm(
      `Revoke Pro from "${current.name || user.name}"? Their Pro access will end immediately.`
    )) {
      return;
    }
    setPending('revoke');
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/admin/users/${user.id}/revoke-pro`, {
        method: 'POST',
        headers: { 'Authorization': sessionToken },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showNotice('danger', data?.detail || 'Failed to revoke Pro');
        return;
      }
      if (data?.user) {
        setDetail(data.user);
        onUserUpdated(data.user);
      } else {
        await refreshDetail();
      }
      setSelectedMonths(null);
      showNotice('success', data?.message || 'Pro membership revoked');
    } catch (e) {
      showNotice('danger', 'Failed to revoke Pro');
    } finally {
      setPending(null);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showNotice('danger', 'Name is required');
      return;
    }
    setPending('profile');
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': sessionToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone_number: (phone || '').trim(),
          bio: bio || '',
          is_admin: isAdmin,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showNotice('danger', data?.detail || 'Failed to save changes');
        return;
      }
      await refreshDetail();
      showNotice('success', 'Profile updated');
    } catch (e) {
      showNotice('danger', 'Failed to save changes');
    } finally {
      setPending(null);
    }
  };

  const isBusy = !!pending;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content user-edit-modal">
          <div className="modal-header">
            <h5 className="modal-title">✏️ Edit User</h5>
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
                <div className="mt-2 text-muted">Loading current status…</div>
              </div>
            ) : (
              <>
                {/* ---------- Identity summary ---------- */}
                <div className="d-flex align-items-start gap-3 mb-4">
                  <div
                    className="user-avatar"
                    style={{
                      width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: '#fff', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontWeight: 700, fontSize: '1.4rem',
                    }}
                  >
                    {(current.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="d-flex align-items-center flex-wrap gap-2">
                      <h5 className="mb-0">{current.name}</h5>
                      {current.is_admin && <span className="badge bg-warning text-dark">Admin</span>}
                      {proActive && (
                        <span className="badge bg-success" title={`Expires ${fmtDateTime(current.pro_expire_date)}`}>
                          Pro
                        </span>
                      )}
                      {proExpired && (
                        <span className="badge bg-secondary" title={`Expired ${fmtDateTime(current.pro_expire_date)}`}>
                          Pro Expired
                        </span>
                      )}
                      {current.ban_type && BAN_TYPE_LABELS[current.ban_type] && (
                        <span className={`badge ${BAN_TYPE_LABELS[current.ban_type].cls}`}>
                          {BAN_TYPE_LABELS[current.ban_type].label}
                        </span>
                      )}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                      <div>{current.email || 'No email'}{current.phone_number ? ` · ${current.phone_number}` : ''}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{current.id}</div>
                    </div>
                  </div>
                </div>

                {/* ---------- Pro membership ---------- */}
                <div className="user-edit-section mb-4">
                  <h6 className="user-edit-section-title">
                    <i className="bi bi-stars me-2 text-success" />
                    Pro Membership
                  </h6>

                  <div className="mb-3" style={{ fontSize: '0.95rem' }}>
                    {proActive ? (
                      <div className="row g-2">
                        <div className="col-sm-6">
                          <div className="text-muted small">Current expiry</div>
                          <div className="fw-semibold">{fmtDateTime(current.pro_expire_date)}</div>
                        </div>
                        <div className="col-sm-6">
                          <div className="text-muted small">Days remaining</div>
                          <div className="fw-semibold">{current.pro_days_remaining} day(s)</div>
                        </div>
                      </div>
                    ) : proExpired ? (
                      <div>
                        <span className="badge bg-secondary me-2">Expired</span>
                        Pro expired on {fmtDateTime(current.pro_expire_date)}.
                        {' '}<span className="text-muted">Granting a new duration restarts it from today.</span>
                      </div>
                    ) : (
                      <div className="text-muted">Not a Pro member.</div>
                    )}
                  </div>

                  <div className="mb-2">
                    <div className="text-muted small mb-2">
                      {proActive
                        ? 'Extend the subscription from its current expiry:'
                        : 'Grant Pro for a preset duration:'}
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      {GRANT_PRESETS.map((p) => (
                        <button
                          key={p.months}
                          type="button"
                          className={`btn btn-sm ${selectedMonths === p.months ? 'btn-success' : 'btn-outline-success'}`}
                          onClick={() => setSelectedMonths(selectedMonths === p.months ? null : p.months)}
                          disabled={isBusy}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    {selectedMonths && (
                      <div className="mt-2 small text-muted">
                        {proActive && current.pro_expire_date
                          ? <>Current expiry <strong>{fmtDate(current.pro_expire_date)}</strong> → new expiry{' '}
                            <strong className="text-success">{previewDate ? fmtDate(previewDate) : '—'}</strong></>
                          : <>Pro will expire on{' '}
                            <strong className="text-success">{previewDate ? fmtDate(previewDate) : '—'}</strong></>}
                      </div>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={!selectedMonths || isBusy}
                      onClick={handleGrant}
                    >
                      {pending === 'grant' && <span className="spinner-border spinner-border-sm me-2" />}
                      {grantButtonLabel}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      disabled={!proActive || isBusy}
                      onClick={handleRevoke}
                      title={proActive ? 'End Pro access immediately' : 'User has no active Pro access'}
                    >
                      {pending === 'revoke' && <span className="spinner-border spinner-border-sm me-2" />}
                      Revoke Pro
                    </button>
                  </div>
                </div>

                {/* ---------- Profile & permissions ---------- */}
                <form onSubmit={handleSaveProfile}>
                  <div className="user-edit-section">
                    <h6 className="user-edit-section-title">
                      <i className="bi bi-person-gear me-2 text-primary" />
                      Profile &amp; Permissions
                    </h6>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Name <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          maxLength={50}
                          required
                          value={name}
                          disabled={isBusy}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Phone Number</label>
                        <input
                          type="tel"
                          className="form-control"
                          value={phone}
                          disabled={isBusy}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Bio</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={bio}
                          disabled={isBusy}
                          onChange={(e) => setBio(e.target.value)}
                        />
                      </div>
                      <div className="col-12">
                        <div className="form-check form-switch">
                          <input
                            id="user-edit-is-admin"
                            type="checkbox"
                            className="form-check-input"
                            role="switch"
                            checked={isAdmin}
                            disabled={isBusy || isSelf}
                            onChange={(e) => setIsAdmin(e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="user-edit-is-admin">
                            Admin privileges
                          </label>
                        </div>
                        {isSelf ? (
                          <small className="text-muted">You cannot change your own admin status.</small>
                        ) : (
                          <small className="form-text text-muted">Grants full access to this admin portal.</small>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-end gap-2 mt-3">
                    <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={isBusy}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isBusy}>
                      {pending === 'profile' && <span className="spinner-border spinner-border-sm me-2" />}
                      Save Profile
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
