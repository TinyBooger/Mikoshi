/**
 * Admin page for Audit Logs
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { auditLogger } from '../../utils/auditLogger';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalLogs, setTotalLogs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    auditLogger.getActions().then((rows) => {
      if (!cancelled) setActions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await auditLogger.getLogs({
        action: actionFilter.trim() || undefined,
        user_id: userFilter.trim() || undefined,
        status: statusFilter || undefined,
        start_date: startDate ? new Date(`${startDate}T00:00:00.000`).toISOString() : undefined,
        end_date: endDate ? new Date(`${endDate}T23:59:59.999`).toISOString() : undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      const items = data.audit_logs || [];
      const total = data.total || 0;
      setLogs(items);
      setTotalLogs(total);

      // Snap back if this page no longer exists (a filter narrowed the result
      // set, rows were pruned, ...). Otherwise the table sits empty while the
      // pager still claims there are more pages.
      const lastPage = Math.max(1, Math.ceil(total / pageSize));
      if (page > lastPage) setPage(lastPage);
    } catch (err) {
      console.error('[AuditLogsPage] Failed to load audit logs page', page, err);
      setError(err.message || 'Failed to load audit logs.');
      setLogs([]);
      setTotalLogs(0);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, userFilter, statusFilter, startDate, endDate, page, pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));
  const firstRow = totalLogs === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, totalLogs);

  // Windowed page numbers so the pager keeps a fixed width on large tables.
  const pageNumbers = useMemo(() => {
    const span = 5;
    const start = Math.max(1, Math.min(page - Math.floor(span / 2), totalPages - span + 1));
    const end = Math.min(totalPages, start + span - 1);
    const numbers = [];
    for (let p = start; p <= end; p += 1) numbers.push(p);
    return numbers;
  }, [page, totalPages]);

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.user_id?.toLowerCase().includes(q) ||
      log.ip_address?.toLowerCase().includes(q) ||
      JSON.stringify(log.meta || {}).toLowerCase().includes(q)
    );
  });

  return (
    <div className="audit-logs-page">
      <div className="container-fluid py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="mb-0">Audit Logs</h1>
        </div>

        <div className="card mb-4">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Action</label>
                <input
                  className="form-control form-control-sm"
                  list="audit-action-options"
                  placeholder="e.g. login (partial match)"
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                />
                <datalist id="audit-action-options">
                  {actions.map((row) => (
                    <option key={row.action} value={row.action}>
                      {row.action} ({row.count})
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="col-md-2">
                <label className="form-label">User ID</label>
                <input
                  className="form-control form-control-sm"
                  placeholder="user id"
                  value={userFilter}
                  onChange={(e) => {
                    setUserFilter(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Status</label>
                <select
                  className="form-select form-select-sm"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">From</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">To</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <div className="row mt-3">
              <div className="col-md-4">
                <label className="form-label">
                  Filter loaded rows <span className="text-muted small">(current page only)</span>
                </label>
                <input
                  className="form-control form-control-sm"
                  placeholder="action, user, ip, metadata"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {error && (
              <div className="alert alert-danger py-2 mb-3" role="alert">
                {error}
              </div>
            )}
            {loading ? (
              <div className="text-center py-5">Loading...</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User ID</th>
                      <th>Action</th>
                      <th>Status</th>
                      <th>IP</th>
                      <th>User Agent</th>
                      <th>Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-4">
                          No audit logs found
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</td>
                          <td>{log.user_id || '-'}</td>
                          <td>{log.action}</td>
                          <td>
                            <span className={`badge ${log.status === 'success' ? 'bg-success' : log.status === 'failure' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                              {log.status || 'unknown'}
                            </span>
                          </td>
                          <td>{log.ip_address || '-'}</td>
                          <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.user_agent || ''}>
                            {log.user_agent || '-'}
                          </td>
                          <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }} title={JSON.stringify(log.meta || {})}>
                            {JSON.stringify(log.meta || {})}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
          <div className="text-muted small">
            {loading
              ? 'Loading\u2026'
              : totalLogs === 0
                ? 'No results'
                : `Showing ${firstRow}\u2013${lastRow} of ${totalLogs}`}
          </div>

          <div className="d-flex align-items-center gap-2">
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>

            <nav aria-label="Audit log pagination">
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                  <button
                    type="button"
                    className="page-link"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Prev
                  </button>
                </li>

                {pageNumbers[0] > 1 && (
                  <li className="page-item disabled">
                    <span className="page-link">{'\u2026'}</span>
                  </li>
                )}

                {pageNumbers.map((number) => (
                  <li key={number} className={`page-item ${number === page ? 'active' : ''}`}>
                    <button
                      type="button"
                      className="page-link"
                      disabled={loading}
                      onClick={() => setPage(number)}
                    >
                      {number}
                    </button>
                  </li>
                ))}

                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                  <li className="page-item disabled">
                    <span className="page-link">{'\u2026'}</span>
                  </li>
                )}

                <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                  <button
                    type="button"
                    className="page-link"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
