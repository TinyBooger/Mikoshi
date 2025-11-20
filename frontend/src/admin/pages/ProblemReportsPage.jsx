import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../components/AuthProvider";

export default function ProblemReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const { sessionToken } = useContext(AuthContext);

  const fetchReports = (status = null) => {
    setLoading(true);
    const url = status && status !== 'all' 
      ? `${window.API_BASE_URL}/api/problem-reports?status=${status}`
      : `${window.API_BASE_URL}/api/problem-reports`;
    
    fetch(url, {
      headers: {
        'Authorization': sessionToken
      }
    })
      .then(res => res.json())
      .then(data => {
        setReports(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching reports:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReports(filterStatus === 'all' ? null : filterStatus);
  }, [sessionToken, filterStatus]);

  const handleStatusChange = async (reportId, newStatus, adminNotes = '') => {
    try {
      const formData = new FormData();
      formData.append('status', newStatus);
      if (adminNotes) {
        formData.append('admin_notes', adminNotes);
      }

      const response = await fetch(`${window.API_BASE_URL}/api/problem-reports/${reportId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': sessionToken,
        },
        body: formData
      });

      if (response.ok) {
        alert('Report status updated successfully');
        fetchReports(filterStatus === 'all' ? null : filterStatus);
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to update status'}`);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const handleDelete = async (reportId) => {
    if (!confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/problem-reports/${reportId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken
        }
      });

      if (response.ok) {
        alert('Report deleted successfully');
        fetchReports(filterStatus === 'all' ? null : filterStatus);
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to delete report'}`);
      }
    } catch (err) {
      console.error('Error deleting report:', err);
      alert('Failed to delete report');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-warning text-dark';
      case 'in-progress':
        return 'bg-info text-white';
      case 'resolved':
        return 'bg-success text-white';
      case 'closed':
        return 'bg-secondary text-white';
      default:
        return 'bg-secondary text-white';
    }
  };

  return (
    <div className="container-fluid">
      <h2 className="mb-4">Problem Reports</h2>
      
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div>
          <label className="me-2 fw-semibold">Filter by Status:</label>
          <select 
            className="form-select d-inline-block w-auto"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Reports</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="text-muted">
          Total: {reports.length} reports
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className="alert alert-info">No problem reports found.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>ID</th>
                <th style={{ width: '15%' }}>User</th>
                <th style={{ width: '35%' }}>Description</th>
                <th style={{ width: '15%' }}>Target</th>
                <th style={{ width: '10%' }}>Screenshot</th>
                <th style={{ width: '10%' }}>Status</th>
                <th style={{ width: '12%' }}>Created</th>
                <th style={{ width: '13%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(report => (
                <tr key={report.id}>
                  <td>#{report.id}</td>
                  <td>
                    <div className="small">
                      <div className="text-truncate" style={{ maxWidth: '150px' }}>
                        {report.user_email || 'Unknown'}
                      </div>
                      {report.user_id && (
                        <small className="text-muted">ID: {report.user_id.substring(0, 8)}...</small>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ maxHeight: '80px', overflow: 'auto' }}>
                      {report.description}
                    </div>
                    {report.admin_notes && (
                      <small className="text-muted d-block mt-1">
                        <strong>Notes:</strong> {report.admin_notes}
                      </small>
                    )}
                  </td>
                  <td>
                    {report.target_type ? (
                      <div className="small">
                        <div className="text-capitalize fw-semibold">{report.target_type}</div>
                        <div className="text-truncate" style={{ maxWidth: '160px' }}>
                          {report.target_name || 'Unnamed'} (ID: {report.target_id})
                        </div>
                        {report.target_id && (
                          <a
                            className="small"
                            href={
                              report.target_type === 'character' ? `/chat?character=${report.target_id}` :
                              report.target_type === 'scene' ? `/chat?scene=${report.target_id}` :
                              report.target_type === 'persona' ? `/chat?persona=${report.target_id}` : '#'
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in Chat
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted">General</span>
                    )}
                  </td>
                  <td>
                    {report.screenshot ? (
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {
                          setSelectedReport(report);
                          setShowImageModal(true);
                        }}
                      >
                        <i className="bi bi-image me-1"></i>
                        View
                      </button>
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(report.status)}`}>
                      {report.status}
                    </span>
                  </td>
                  <td>
                    <small>{formatDate(report.created_time)}</small>
                  </td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <select
                        className="form-select form-select-sm"
                        value={report.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          const notes = prompt('Add admin notes (optional):');
                          handleStatusChange(report.id, newStatus, notes || '');
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(report.id)}
                        title="Delete report"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && selectedReport && selectedReport.screenshot && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Screenshot - Report #{selectedReport.id}</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowImageModal(false);
                    setSelectedReport(null);
                  }}
                ></button>
              </div>
              <div className="modal-body text-center">
                <img 
                  src={selectedReport.screenshot} 
                  alt="Problem screenshot" 
                  style={{ maxWidth: '100%', maxHeight: '70vh' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
