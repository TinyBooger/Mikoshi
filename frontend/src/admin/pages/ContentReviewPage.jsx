import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../components/AuthProvider';
import PaginationBar from '../../components/PaginationBar';

export default function ContentReviewPage() {
  const navigate = useNavigate();
  const { sessionToken } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const [resolvingId, setResolvingId] = useState(null);
  const pageSize = 20;

  const fetchQueue = async (status = 'pending') => {
    setLoading(true);
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/review-queue?status=${encodeURIComponent(status)}`, {
        headers: {
          Authorization: sessionToken,
        },
      });
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch content review queue:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue(statusFilter);
  }, [sessionToken, statusFilter]);

  const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  };

  const handleResolve = async (item, action) => {
    const notes = prompt('Add review notes (optional):') || '';
    setResolvingId(item.id);
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/review-queue/${item.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: sessionToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Failed to resolve: ${error.detail || 'Unknown error'}`);
        return;
      }

      fetchQueue(statusFilter);
    } catch (error) {
      console.error('Failed to resolve content review item:', error);
      alert('Failed to resolve content review item');
    } finally {
      setResolvingId(null);
    }
  };

  const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Content Review Queue</h2>
        <span className="text-muted">Total: {items.length}</span>
      </div>

      <div className="d-flex align-items-center gap-2 mb-3">
        <label className="fw-semibold">Status:</label>
        <select
          className="form-select w-auto"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="pending">Pending</option>
          <option value="all">All</option>
          <option value="resolved_keep">Resolved - Keep</option>
          <option value="resolved_hide">Resolved - Hidden</option>
          <option value="resolved_delete">Resolved - Deleted</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="alert alert-info">No items in this review queue view.</div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Character</th>
                  <th>Source</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id}</td>
                    <td>
                      <div className="small">
                        <div className="fw-semibold">
                          {item.character_name || `Character #${item.character_id || '-'}`}
                        </div>
                        <div className="text-muted">ID: {item.character_id || '-'}</div>
                        <div className="text-muted">
                          {item.character_exists ? (item.character_is_public ? 'Public' : 'Hidden') : 'Deleted'}
                        </div>
                        {item.character_exists && item.character_id && (
                          <button
                            className="btn btn-sm btn-link p-0 mt-1"
                            onClick={() => navigate(`/character/${item.character_id}`)}
                          >
                            Open Character Details
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${item.source === 'moderation_review' ? 'bg-warning text-dark' : 'bg-info text-dark'}`}>
                        {item.source}
                      </span>
                      {item.triggered_by_report_id && (
                        <div className="small mt-1">Report #{item.triggered_by_report_id}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ maxWidth: 360, maxHeight: 100, overflow: 'auto' }}>
                        {item.reason || '-'}
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-secondary">{item.status}</span>
                    </td>
                    <td>{formatDate(item.created_time)}</td>
                    <td>
                      {item.status === 'pending' ? (
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-success"
                            disabled={resolvingId === item.id}
                            onClick={() => handleResolve(item, 'keep')}
                          >
                            Keep
                          </button>
                          <button
                            className="btn btn-outline-warning"
                            disabled={resolvingId === item.id}
                            onClick={() => handleResolve(item, 'hide')}
                          >
                            Hide
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            disabled={resolvingId === item.id}
                            onClick={() => handleResolve(item, 'delete')}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted small">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={page}
            total={items.length}
            pageSize={pageSize}
            loading={loading}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
