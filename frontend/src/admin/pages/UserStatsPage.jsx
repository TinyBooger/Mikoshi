import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../components/AuthProvider';
import Table from '../components/Table';
import PaginationBar from '../../components/PaginationBar';

export default function UserStatsPage() {
  const { sessionToken } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [lookupUserId, setLookupUserId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState(null);

  // ── User usage ranking (tokens + chats) ────────────────────────────────────
  const [usageData, setUsageData] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState('');
  const [usageWindow, setUsageWindow] = useState(30);
  const [usageSort, setUsageSort] = useState({ key: 'total_tokens', dir: 'desc' });
  const [usagePage, setUsagePage] = useState(1);
  const [usageSearchInput, setUsageSearchInput] = useState('');
  const [usageSearch, setUsageSearch] = useState('');
  const usagePageSize = 20;

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

  // Debounce the usage search box
  useEffect(() => {
    const timer = setTimeout(() => {
      setUsageSearch(usageSearchInput.trim());
      setUsagePage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [usageSearchInput]);

  const fetchUsage = useCallback(async () => {
    if (!sessionToken) return;
    setUsageLoading(true);
    setUsageError('');
    try {
      const params = new URLSearchParams({
        days: String(usageWindow),
        sort_by: usageSort.key,
        sort_dir: usageSort.dir,
        page: String(usagePage),
        page_size: String(usagePageSize),
      });
      if (usageSearch) params.set('search', usageSearch);

      const response = await fetch(`${window.API_BASE_URL}/api/admin/user-stats/user-usage?${params.toString()}`, {
        headers: { Authorization: sessionToken },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Failed to load user usage');
      }
      setUsageData(await response.json());
    } catch (err) {
      setUsageError(err.message || 'Failed to load user usage');
      setUsageData(null);
    } finally {
      setUsageLoading(false);
    }
  }, [sessionToken, usageWindow, usageSort, usagePage, usageSearch]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const handleUsageSort = (key) => {
    setUsagePage(1);
    setUsageSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' }
    );
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
      title: 'Today Credit Sum',
      value: Number(metrics.today_credit_sum || 0).toFixed(2),
      subtitle: 'Total credits consumed today',
      border: 'info',
      icon: 'bi-coin',
    },
  ];

  const usageColumns = [
    { key: 'user', label: 'User' },
    { key: 'total_tokens', label: 'Tokens', sortable: true, align: 'end' },
    { key: 'credit_amount', label: 'Credits', sortable: true, align: 'end' },
    { key: 'chat_count', label: 'Chats', sortable: true, align: 'end' },
    { key: 'message_count', label: 'Messages', sortable: true, align: 'end' },
    { key: 'last_active_at', label: 'Last Active', sortable: true },
  ];

  const usageRows = (usageData?.items || []).map((row) => ({
    ...row,
    id: row.user_id,
    user: (
      <div>
        <button
          type="button"
          className="btn btn-link p-0 text-start fw-semibold text-decoration-none"
          onClick={() => navigate('/admin/users', { state: { highlightUserId: row.user_id } })}
          title="View in Users tab"
        >
          {row.name || row.user_id}
        </button>
        <div className="text-muted small">{row.email || row.phone_number || row.user_id}</div>
      </div>
    ),
    total_tokens: Number(row.total_tokens || 0).toLocaleString(),
    credit_amount: Number(row.credit_amount || 0).toFixed(2),
    chat_count: Number(row.chat_count || 0).toLocaleString(),
    message_count: Number(row.message_count || 0).toLocaleString(),
    last_active_at: row.last_active_at ? new Date(row.last_active_at).toLocaleString() : '—',
  }));

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
                          <div className="text-muted small">Credits: {Number(lookupResult.daily_credits || 0).toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Monthly Tokens</div>
                          <div className="fs-5 fw-bold">{Number(lookupResult.monthly_tokens || 0).toLocaleString()}</div>
                          <div className="text-muted small">Credits: {Number(lookupResult.monthly_credits || 0).toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="col-sm-6 col-lg-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Rolling 30d Tokens</div>
                          <div className="fs-5 fw-bold">{Number(lookupResult.rolling_30d_tokens || 0).toLocaleString()}</div>
                          <div className="text-muted small">Credits: {Number(lookupResult.rolling_30d_credits || 0).toFixed(2)}</div>
                          <div className="small text-muted">Daily chat sessions: {lookupResult.daily_chat_sessions || 0}</div>
                          <div className="small text-muted">Wallet: {Number(lookupResult.purchased_credit_balance || 0).toFixed(2)} credits</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <strong>Active Users by Usage</strong>
                  <div className="d-flex gap-2 flex-wrap">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      style={{ maxWidth: 260 }}
                      placeholder="🔍 Search name, email, or ID..."
                      value={usageSearchInput}
                      onChange={(e) => setUsageSearchInput(e.target.value)}
                    />
                    <select
                      className="form-select form-select-sm"
                      style={{ maxWidth: 150 }}
                      value={usageWindow}
                      onChange={(e) => {
                        setUsageWindow(Number(e.target.value));
                        setUsagePage(1);
                      }}
                    >
                      <option value={1}>Today</option>
                      <option value={7}>Last 7 days</option>
                      <option value={30}>Last 30 days</option>
                      <option value={90}>Last 90 days</option>
                      <option value={365}>Last 365 days</option>
                    </select>
                  </div>
                </div>
                <div className="card-body p-0">
                  {usageError && (
                    <div className="alert alert-danger m-3 mb-0" role="alert">{usageError}</div>
                  )}
                  <div className="px-3 pt-2 pb-1 text-muted small">
                    Token/credit totals cover the selected window; chats and messages are lifetime totals.
                    Click a name to open that user in the Users tab.
                  </div>
                  <div className="table-responsive">
                    <Table
                      columns={usageColumns}
                      data={usageRows}
                      actions={false}
                      sort={usageSort}
                      onSort={handleUsageSort}
                      emptyMessage={usageLoading ? 'Loading…' : 'No users found'}
                    />
                  </div>
                </div>
              </div>
              <PaginationBar
                page={usagePage}
                total={usageData?.total ?? 0}
                pageSize={usagePageSize}
                loading={usageLoading}
                onPageChange={setUsagePage}
              />
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
                <li>{data?.notes?.credit_usage || ''}</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}