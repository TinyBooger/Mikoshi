/**
 * Admin Dashboard Page for Error Logs
 * Displays, filters, and manages application error logs
 */
import React, { useState, useEffect, useCallback } from 'react';
import { errorLogger } from '../../utils/errorLogger';

export default function ErrorLogsPage() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ offset: 0, limit: 50 });
  const [totalLogs, setTotalLogs] = useState(0);

  // Load summary on mount
  useEffect(() => {
    loadSummary();
  }, []);

  // Load logs whenever filters change
  useEffect(() => {
    loadLogs();
  }, [selectedFilter, severityFilter, sourceFilter, pagination.offset]);

  const loadSummary = async () => {
    const data = await errorLogger.getSummary();
    setSummary(data);
  };

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        severity: severityFilter || undefined,
        source: sourceFilter || undefined,
        resolved: selectedFilter === 'resolved' ? true : selectedFilter === 'unresolved' ? false : undefined,
        limit: pagination.limit,
        offset: pagination.offset,
      };

      const data = await errorLogger.getLogs(filters);
      
      if (data) {
        setLogs(data.error_logs || []);
        setTotalLogs(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedFilter, severityFilter, sourceFilter, pagination]);

  const handleResolve = async (errorId, currentResolved) => {
    await errorLogger.resolveError(errorId, !currentResolved);
    await loadLogs();
    await loadSummary();
  };

  const handleDelete = async (errorId) => {
    if (window.confirm('Are you sure you want to delete this error log?')) {
      const success = await errorLogger.deleteError(errorId);
      if (success) {
        await loadLogs();
        await loadSummary();
      }
    }
  };

  const handleDeleteOld = async () => {
    const days = prompt('Delete error logs older than how many days?', '30');
    if (days) {
      const result = await errorLogger.deleteOldLogs(parseInt(days));
      if (result) {
        alert(`Deleted ${result.deleted_count} error logs`);
        await loadLogs();
        await loadSummary();
      }
    }
  };

  const totalPages = Math.ceil(totalLogs / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const filteredLogs = logs.filter(log =>
    !searchQuery ||
    log.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.error_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.endpoint?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="error-logs-page">
      <div className="container-fluid py-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="mb-0">Error Logs</h1>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDeleteOld}
            disabled={loading}
          >
            Delete Old Logs
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card bg-light">
                <div className="card-body">
                  <h6 className="card-title text-muted">Last 24 Hours</h6>
                  <h3 className="card-text">{summary.errors_last_24h}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-light">
                <div className="card-body">
                  <h6 className="card-title text-muted">Last 7 Days</h6>
                  <h3 className="card-text">{summary.errors_last_7d}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-danger bg-opacity-10">
                <div className="card-body">
                  <h6 className="card-title text-danger">Critical (Unresolved)</h6>
                  <h3 className="card-text text-danger">{summary.critical_unresolved}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-light">
                <div className="card-body">
                  <h6 className="card-title text-muted">Total</h6>
                  <h3 className="card-text">{totalLogs}</h3>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="row">
              <div className="col-md-3">
                <label className="form-label">Status</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedFilter}
                  onChange={(e) => {
                    setSelectedFilter(e.target.value);
                    setPagination({ ...pagination, offset: 0 });
                  }}
                >
                  <option value="all">All</option>
                  <option value="unresolved">Unresolved</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Severity</label>
                <select
                  className="form-select form-select-sm"
                  value={severityFilter}
                  onChange={(e) => {
                    setSeverityFilter(e.target.value);
                    setPagination({ ...pagination, offset: 0 });
                  }}
                >
                  <option value="">All Severities</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Source</label>
                <select
                  className="form-select form-select-sm"
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setPagination({ ...pagination, offset: 0 });
                  }}
                >
                  <option value="">All Sources</option>
                  <option value="backend">Backend</option>
                  <option value="frontend">Frontend</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Search</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search errors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="card">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '12%' }}>Timestamp</th>
                  <th style={{ width: '10%' }}>Severity</th>
                  <th style={{ width: '12%' }}>Error Type</th>
                  <th style={{ width: '18%' }}>Message</th>
                  <th style={{ width: '15%' }}>Endpoint</th>
                  <th style={{ width: '10%' }}>Source</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '13%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4">
                      <div className="spinner-border spinner-border-sm" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4 text-muted">
                      No error logs found
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.85rem' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge bg-${getSeverityColor(log.severity)}`}>
                          {log.severity}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', maxWidth: '150px' }}>
                        <code className="text-danger">{log.error_type}</code>
                      </td>
                      <td style={{ fontSize: '0.85rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.message}
                      </td>
                      <td style={{ fontSize: '0.85rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.endpoint || <span className="text-muted">-</span>}
                      </td>
                      <td>
                        <span className={`badge bg-${log.source === 'frontend' ? 'info' : 'secondary'}`}>
                          {log.source}
                        </span>
                      </td>
                      <td>
                        {log.resolved ? (
                          <span className="badge bg-success">Resolved</span>
                        ) : (
                          <span className="badge bg-warning">Unresolved</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm" role="group">
                          <button
                            className="btn btn-outline-secondary"
                            onClick={() => {
                              // Show detailed view
                              showErrorDetails(log);
                            }}
                            title="View details"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          <button
                            className={`btn btn-outline-${log.resolved ? 'warning' : 'success'}`}
                            onClick={() => handleResolve(log.id, log.resolved)}
                            title={log.resolved ? 'Mark unresolved' : 'Mark resolved'}
                          >
                            <i className={`bi bi-${log.resolved ? 'arrow-counterclockwise' : 'check'}`}></i>
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => handleDelete(log.id)}
                            title="Delete"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="card-footer bg-light d-flex justify-content-between align-items-center">
              <small className="text-muted">
                Page {currentPage} of {totalPages} ({totalLogs} total errors)
              </small>
              <nav>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${pagination.offset === 0 ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setPagination({ ...pagination, offset: 0 })}
                      disabled={pagination.offset === 0}
                    >
                      First
                    </button>
                  </li>
                  <li className={`page-item ${pagination.offset === 0 ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setPagination({
                        ...pagination,
                        offset: Math.max(0, pagination.offset - pagination.limit)
                      })}
                      disabled={pagination.offset === 0}
                    >
                      Previous
                    </button>
                  </li>
                  <li className="page-item active">
                    <span className="page-link">{currentPage}</span>
                  </li>
                  <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setPagination({
                        ...pagination,
                        offset: pagination.offset + pagination.limit
                      })}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                    </button>
                  </li>
                  <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setPagination({
                        ...pagination,
                        offset: (totalPages - 1) * pagination.limit
                      })}
                      disabled={currentPage >= totalPages}
                    >
                      Last
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Error Details Modal */}
      <ErrorDetailsModal />
    </div>
  );
}

/**
 * Get Bootstrap color class for severity level
 */
function getSeverityColor(severity) {
  switch (severity) {
    case 'critical':
      return 'danger';
    case 'error':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'secondary';
  }
}

/**
 * Store for error details modal
 */
let currentError = null;
let showDetailsCallback = null;

function showErrorDetails(log) {
  currentError = log;
  if (showDetailsCallback) {
    showDetailsCallback();
  }
}

/**
 * Error Details Modal Component
 */
function ErrorDetailsModal() {
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);

  // Register callback
  useEffect(() => {
    showDetailsCallback = () => {
      setError(currentError);
      setShowModal(true);
    };
  }, []);

  if (!error) return null;

  return (
    <div className={`modal fade ${showModal ? 'show' : ''}`} style={{ display: showModal ? 'block' : 'none' }} tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Error Log Details</h5>
            <button
              type="button"
              className="btn-close"
              onClick={() => setShowModal(false)}
            ></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <h6 className="text-muted">Message</h6>
              <p className="font-monospace bg-light p-2 rounded">{error.message}</p>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <h6 className="text-muted">Error Type</h6>
                <code>{error.error_type}</code>
              </div>
              <div className="col-md-6">
                <h6 className="text-muted">Severity</h6>
                <span className={`badge bg-${getSeverityColor(error.severity)}`}>
                  {error.severity}
                </span>
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <h6 className="text-muted">Source</h6>
                <span className={`badge bg-${error.source === 'frontend' ? 'info' : 'secondary'}`}>
                  {error.source}
                </span>
              </div>
              <div className="col-md-6">
                <h6 className="text-muted">Timestamp</h6>
                <small>{new Date(error.timestamp).toLocaleString()}</small>
              </div>
            </div>

            {error.endpoint && (
              <div className="mb-3">
                <h6 className="text-muted">Endpoint</h6>
                <code>{error.method} {error.endpoint}</code>
              </div>
            )}

            {error.client_ip && (
              <div className="row mb-3">
                <div className="col-md-6">
                  <h6 className="text-muted">Client IP</h6>
                  <code>{error.client_ip}</code>
                </div>
                {error.status_code && (
                  <div className="col-md-6">
                    <h6 className="text-muted">Status Code</h6>
                    <code>{error.status_code}</code>
                  </div>
                )}
              </div>
            )}

            {error.user_agent && (
              <div className="mb-3">
                <h6 className="text-muted">User Agent</h6>
                <small className="text-break">{error.user_agent}</small>
              </div>
            )}

            {error.stack_trace && (
              <div className="mb-3">
                <h6 className="text-muted">Stack Trace</h6>
                <pre className="bg-light p-2 rounded text-break" style={{ fontSize: '0.75rem', maxHeight: '300px', overflow: 'auto' }}>
                  {error.stack_trace}
                </pre>
              </div>
            )}

            {error.context && (
              <div className="mb-3">
                <h6 className="text-muted">Context</h6>
                <pre className="bg-light p-2 rounded text-break" style={{ fontSize: '0.75rem', maxHeight: '200px', overflow: 'auto' }}>
                  {typeof error.context === 'string' ? error.context : JSON.stringify(JSON.parse(error.context), null, 2)}
                </pre>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
      {showModal && <div className="modal-backdrop fade show"></div>}
    </div>
  );
}
