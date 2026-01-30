/**
 * Admin page for Audit Logs
 */
import React, { useEffect, useState, useCallback } from 'react';
import { auditLogger } from '../../utils/auditLogger';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ offset: 0, limit: 50 });
  const [totalLogs, setTotalLogs] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditLogger.getLogs({
        action: actionFilter || undefined,
        user_id: userFilter || undefined,
        status: statusFilter || undefined,
        limit: pagination.limit,
        offset: pagination.offset,
      });

      if (data) {
        setLogs(data.audit_logs || []);
        setTotalLogs(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [actionFilter, userFilter, statusFilter, pagination]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.ceil(totalLogs / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

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
            <div className="row">
              <div className="col-md-3">
                <label className="form-label">Action</label>
                <input
                  className="form-control form-control-sm"
                  placeholder="e.g. login"
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPagination({ ...pagination, offset: 0 });
                  }}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">User ID</label>
                <input
                  className="form-control form-control-sm"
                  placeholder="user id"
                  value={userFilter}
                  onChange={(e) => {
                    setUserFilter(e.target.value);
                    setPagination({ ...pagination, offset: 0 });
                  }}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Status</label>
                <select
                  className="form-select form-select-sm"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPagination({ ...pagination, offset: 0 });
                  }}
                >
                  <option value="">All</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Search</label>
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

        <div className="d-flex justify-content-between align-items-center mt-3">
          <div className="text-muted">Total: {totalLogs}</div>
          <div className="btn-group">
            <button
              className="btn btn-outline-secondary btn-sm"
              disabled={currentPage <= 1}
              onClick={() => setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })}
            >
              Prev
            </button>
            <button className="btn btn-outline-secondary btn-sm" disabled>
              Page {currentPage} / {totalPages}
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPagination({ ...pagination, offset: pagination.offset + pagination.limit })}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
