import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../components/AuthProvider';
import PaginationBar from '../../components/PaginationBar';

export default function InvitationCodesPage() {
  const [codes, setCodes] = useState([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;
  const { sessionToken } = useContext(AuthContext);

  const fetchCodes = () => {
    setLoading(true);
    fetch(`${window.API_BASE_URL}/api/admin/invitations`, {
      headers: {
        'Authorization': sessionToken
      }
    })
      .then(res => res.json())
      .then(data => {
        setCodes(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching invitation codes:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCodes();
  }, [sessionToken]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const maxUses = parseInt(formData.get('max_uses')) || 1;
    const expiresInDays = parseInt(formData.get('expires_in_days')) || 30;
    const notes = formData.get('notes') || '';

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/invitations/generate`, {
        method: 'POST',
        headers: {
          'Authorization': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          max_uses: maxUses,
          expires_in_days: expiresInDays,
          notes: notes
        })
      });

      if (response.ok) {
        const result = await response.json();
        setGeneratedCode(result.code);
        fetchCodes();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to generate code'}`);
      }
    } catch (err) {
      console.error('Error generating code:', err);
      alert('Failed to generate invitation code');
    }
  };

  const handleRevoke = async (code) => {
    if (!confirm(`Are you sure you want to revoke invitation code "${code}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/invitations/${code}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken
        }
      });

      if (response.ok) {
        alert('Invitation code revoked successfully');
        fetchCodes();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to revoke code'}`);
      }
    } catch (err) {
      console.error('Error revoking code:', err);
      alert('Failed to revoke invitation code');
    }
  };

  const handleReactivate = async (code) => {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/invitations/${code}/reactivate`, {
        method: 'PATCH',
        headers: {
          'Authorization': sessionToken
        }
      });

      if (response.ok) {
        alert('Invitation code reactivated successfully');
        fetchCodes();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to reactivate code'}`);
      }
    } catch (err) {
      console.error('Error reactivating code:', err);
      alert('Failed to reactivate invitation code');
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    alert('Code copied to clipboard!');
  };

  const getStatusBadge = (code) => {
    if (code.status === 'active') {
      return <span className="badge bg-success">Active</span>;
    } else if (code.status === 'expired') {
      return <span className="badge bg-warning">Expired</span>;
    } else if (code.status === 'exhausted') {
      return <span className="badge bg-secondary">Exhausted</span>;
    } else if (code.status === 'revoked') {
      return <span className="badge bg-danger">Revoked</span>;
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2>Invitation Codes</h2>
          <p className="text-muted mb-0">Manage alpha test invitation codes - Total: {codes.length} codes</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowGenerateModal(true)}
        >
          <i className="bi bi-plus-circle me-2"></i>
          Generate Code
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead className="table-dark">
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Uses</th>
              <th>Used By</th>
              <th>Expires</th>
              <th>Created</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center text-muted py-4">
                  No invitation codes yet. Generate one to get started!
                </td>
              </tr>
            ) : (
              codes.slice((page - 1) * pageSize, page * pageSize).map((code) => (
                <tr key={code.code}>
                  <td>
                    <code className="user-select-all">{code.code}</code>
                    <button
                      className="btn btn-sm btn-link p-0 ms-2"
                      onClick={() => copyToClipboard(code.code)}
                      title="Copy to clipboard"
                    >
                      <i className="bi bi-clipboard"></i>
                    </button>
                  </td>
                  <td>{getStatusBadge(code)}</td>
                  <td>
                    {code.use_count} / {code.max_uses}
                  </td>
                  <td>
                    {code.used_by_username ? (
                      <span className="text-primary">{code.used_by_username}</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    {code.expires_at 
                      ? new Date(code.expires_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td>{new Date(code.created_at).toLocaleDateString()}</td>
                  <td className="text-truncate" style={{ maxWidth: '200px' }}>
                    {code.notes || '-'}
                  </td>
                  <td>
                    <div className="btn-group btn-group-sm" role="group">
                      {code.status === 'active' ? (
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => handleRevoke(code.code)}
                          title="Revoke"
                        >
                          <i className="bi bi-x-circle"></i>
                        </button>
                      ) : code.status === 'revoked' ? (
                        <button
                          className="btn btn-outline-success"
                          onClick={() => handleReactivate(code.code)}
                          title="Reactivate"
                        >
                          <i className="bi bi-arrow-clockwise"></i>
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={page}
        total={codes.length}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
      />

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Generate Invitation Code</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowGenerateModal(false);
                    setGeneratedCode(null);
                  }}
                ></button>
              </div>
              {generatedCode ? (
                <div className="modal-body text-center">
                  <div className="alert alert-success">
                    <i className="bi bi-check-circle me-2"></i>
                    Code generated successfully!
                  </div>
                  <div className="card bg-light">
                    <div className="card-body">
                      <h3 className="font-monospace user-select-all">{generatedCode}</h3>
                      <button
                        className="btn btn-primary mt-2"
                        onClick={() => copyToClipboard(generatedCode)}
                      >
                        <i className="bi bi-clipboard me-2"></i>
                        Copy to Clipboard
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleGenerate}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label fw-bold">Max Uses</label>
                      <input
                        type="number"
                        className="form-control"
                        name="max_uses"
                        defaultValue="1"
                        min="1"
                        max="100"
                        required
                      />
                      <small className="form-text text-muted">
                        How many users can use this code
                      </small>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Expires In (days)</label>
                      <input
                        type="number"
                        className="form-control"
                        name="expires_in_days"
                        defaultValue="30"
                        min="1"
                        max="365"
                      />
                      <small className="form-text text-muted">
                        Leave at 0 for no expiration
                      </small>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Notes (Optional)</label>
                      <textarea
                        className="form-control"
                        name="notes"
                        rows="2"
                        placeholder="E.g., For beta testers, For influencers, etc."
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => setShowGenerateModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Generate
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
