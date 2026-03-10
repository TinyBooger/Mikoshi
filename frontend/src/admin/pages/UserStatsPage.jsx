import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../../components/AuthProvider';

export default function UserStatsPage() {
  const { sessionToken } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [lookupUserId, setLookupUserId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/user-stats`, {
        headers: {
          Authorization: sessionToken,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Failed to load user statistics');
      }

      const payload = await response.json();
      setData(payload);
    } catch (err) {
      setError(err.message || 'Failed to load user statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionToken) {
      fetchStats();
    }
  }, [sessionToken]);

  const fetchSingleUserUsage = async () => {
    const userId = lookupUserId.trim();
    if (!userId) {
      setLookupError('Please enter a user ID');
      setLookupResult(null);
      return;
    }

    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/user-stats/user/${encodeURIComponent(userId)}`, {
        headers: {
          Authorization: sessionToken,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Failed to load user token usage');
      }

      const payload = await response.json();
      setLookupResult(payload);
    } catch (err) {
      setLookupError(err.message || 'Failed to load user token usage');
    } finally {
      setLookupLoading(false);
    }
  };

  const metrics = data?.metrics || {};

  const userIncreaseDelta = useMemo(() => {
    const today = Number(metrics.user_increase_today || 0);
    const yesterday = Number(metrics.user_increase_yesterday || 0);
    if (yesterday === 0) {
      return today > 0 ? '+100%' : '0%';
    }
    const change = ((today - yesterday) / yesterday) * 100;
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  }, [metrics.user_increase_today, metrics.user_increase_yesterday]);

  const cards = [
    {
      title: 'User Count',
      value: metrics.user_count ?? 0,
      subtitle: 'Total registered users',
      border: 'primary',
      icon: 'bi-people',
    },
    {
      title: 'User Increase',
      value: metrics.user_increase_today ?? 0,
      subtitle: `Today (${userIncreaseDelta} vs yesterday)`,
      border: 'success',
      icon: 'bi-graph-up-arrow',
    },
    {
      title: 'DAU',
      value: metrics.dau ?? 0,
      subtitle: 'Daily active users',
      border: 'info',
      icon: 'bi-activity',
    },
    {
      title: 'Pro User Rate',
      value: `${Number(metrics.active_pro_user_rate || 0).toFixed(2)}%`,
      subtitle: `${metrics.active_pro_user_count || 0} active pro users`,
      border: 'warning',
      icon: 'bi-star-fill',
    },
    {
      title: 'D1 Retention',
      value: `${Number(metrics.d1_retention || 0).toFixed(2)}%`,
      subtitle: 'Cohort next-day retention',
      border: 'secondary',
      icon: 'bi-calendar-check',
    },
    {
      title: 'D7 Retention',
      value: `${Number(metrics.d7_retention || 0).toFixed(2)}%`,
      subtitle: 'Cohort day-7 retention',
      border: 'dark',
      icon: 'bi-calendar-week',
    },
    {
      title: 'Avg Chat Length',
      value: Number(metrics.avg_chat_length || 0).toFixed(2),
      subtitle: 'Messages per chat session',
      border: 'primary',
      icon: 'bi-chat-dots',
    },
    {
      title: 'Avg Daily Token Usage',
      value: Number(metrics.avg_daily_tokens_per_active_user || 0).toFixed(2),
      subtitle: 'API usage.total_tokens per active user',
      border: 'success',
      icon: 'bi-cpu',
    },
  ];

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="mb-0">User Data Statistics</h1>
          <small className="text-muted">
            Snapshot: {data?.snapshot_at ? new Date(data.snapshot_at).toLocaleString() : '-'}
          </small>
        </div>
        <button className="btn btn-outline-primary" onClick={fetchStats} disabled={loading}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">Loading statistics...</div>
      ) : (
        <>
          <div className="row g-3 mb-4">
            {cards.map((card) => (
              <div className="col-12 col-sm-6 col-lg-3" key={card.title}>
                <div className={`card h-100 border-${card.border}`}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <h6 className="text-muted mb-2">{card.title}</h6>
                      <i className={`bi ${card.icon}`}></i>
                    </div>
                    <h3 className="mb-1">{card.value}</h3>
                    <small className="text-muted">{card.subtitle}</small>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <strong>Lookup Specific User Token Usage</strong>
                </div>
                <div className="card-body">
                  <div className="d-flex gap-2 flex-wrap align-items-center mb-3">
                    <input
                      type="text"
                      className="form-control"
                      style={{ maxWidth: 360 }}
                      placeholder="Enter user ID"
                      value={lookupUserId}
                      onChange={(e) => setLookupUserId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          fetchSingleUserUsage();
                        }
                      }}
                    />
                    <button className="btn btn-primary" onClick={fetchSingleUserUsage} disabled={lookupLoading}>
                      {lookupLoading ? 'Checking...' : 'Check'}
                    </button>
                  </div>

                  {lookupError && (
                    <div className="alert alert-danger mb-0" role="alert">
                      {lookupError}
                    </div>
                  )}

                  {lookupResult && (
                    <div className="row g-3">
                      <div className="col-sm-6 col-lg-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">User</div>
                          <div className="fw-semibold text-truncate" title={lookupResult.user_id}>{lookupResult.user_name || lookupResult.user_id}</div>
                          <div className="small text-muted text-truncate" title={lookupResult.user_id}>{lookupResult.user_id}</div>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Daily Tokens</div>
                          <div className="fs-5 fw-bold">{Number(lookupResult.daily_tokens || 0).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Monthly Tokens</div>
                          <div className="fs-5 fw-bold">{Number(lookupResult.monthly_tokens || 0).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Rolling 30d Tokens</div>
                          <div className="fs-5 fw-bold">{Number(lookupResult.rolling_30d_tokens || 0).toLocaleString()}</div>
                          <div className="small text-muted">Daily chat sessions: {lookupResult.daily_chat_sessions || 0}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">
                  <strong>Single User Daily Token Usage (Top 10)</strong>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-sm table-striped mb-0">
                      <thead>
                        <tr>
                          <th>User ID</th>
                          <th className="text-end">Token Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.single_user_daily_token_usage || []).length === 0 ? (
                          <tr>
                            <td colSpan="2" className="text-center py-3 text-muted">No usage data today</td>
                          </tr>
                        ) : (
                          data.single_user_daily_token_usage.map((row) => (
                            <tr key={row.user_id}>
                              <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.user_id}</td>
                              <td className="text-end">{Number(row.total_tokens || 0).toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">
                  <strong>Top Daily Message Users (Top 10)</strong>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-sm table-striped mb-0">
                      <thead>
                        <tr>
                          <th>User ID</th>
                          <th className="text-end">Daily Messages</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.top_daily_message_users || []).length === 0 ? (
                          <tr>
                            <td colSpan="2" className="text-center py-3 text-muted">No message data today</td>
                          </tr>
                        ) : (
                          data.top_daily_message_users.map((row) => (
                            <tr key={row.user_id}>
                              <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.user_id}</td>
                              <td className="text-end">{row.daily_messages}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h6>Additional helpful metrics</h6>
              <ul className="mb-0 text-muted">
                <li>WAU: {metrics.wau ?? 0}</li>
                <li>MAU: {metrics.mau ?? 0}</li>
                <li>Total chat sessions: {metrics.total_chat_sessions ?? 0}</li>
                <li>{data?.notes?.retention || ''}</li>
                <li>{data?.notes?.token_usage || ''}</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}