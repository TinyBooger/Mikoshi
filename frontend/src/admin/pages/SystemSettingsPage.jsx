import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../components/AuthProvider';
import { useToast } from '../../components/ToastProvider';

export default function SystemSettingsPage() {
  const { sessionToken } = useContext(AuthContext);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [code, setCode] = useState(null);
  const [error, setError] = useState('');

  const loadState = async () => {
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/admin/dev-sms-bypass`, {
        headers: { Authorization: sessionToken },
      });
      const data = await res.json();
      setAvailable(!!data.available);
      setEnabled(!!data.enabled);
      setCode(data.code);
    } catch (err) {
      setError('Failed to load settings');
      console.error('Error loading dev SMS bypass state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const handleToggle = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/admin/dev-sms-bypass`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: sessionToken,
        },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to update setting');
      }
      const data = await res.json();
      setEnabled(!!data.enabled);
      setCode(data.code);
      if (toast && toast.show) {
        toast.show(data.enabled ? 'Dev SMS bypass enabled' : 'Dev SMS bypass disabled', { type: 'success' });
      }
    } catch (err) {
      setError(err.message || 'Failed to update setting');
      if (toast && toast.show) toast.show(err.message || 'Failed to update setting', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h1>System Settings</h1>
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1>System Settings</h1>
      <p className="text-muted">Application-wide configuration toggles.</p>

      <div className="row mt-4">
        <div className="col-md-6">
          <div className={`card ${available ? 'border-warning' : 'border-secondary'}`}>
            <div className="card-body">
              <h5 className="card-title">
                <i className="bi bi-phone me-2"></i>Dev SMS Bypass
                {available && (
                  <span className="badge bg-warning text-dark ms-2">Dev only</span>
                )}
              </h5>
              <p className="text-muted">
                Allow logging in with a universal verification code instead of a real SMS,
                so you can test without a valid phone number.
              </p>

              {!available ? (
                <div className="alert alert-secondary mb-0">
                  Not available — this feature only works outside the production environment.
                </div>
              ) : (
                <>
                  <div className="form-check form-switch mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="devSmsBypassSwitch"
                      checked={enabled}
                      disabled={saving}
                      onChange={handleToggle}
                    />
                    <label className="form-check-label" htmlFor="devSmsBypassSwitch">
                      {enabled ? 'Enabled' : 'Disabled'}
                    </label>
                  </div>
                  {enabled && code && (
                    <div className="alert alert-warning mb-0">
                      Universal code: <strong>{code}</strong>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger mt-3">{error}</div>}
    </div>
  );
}
