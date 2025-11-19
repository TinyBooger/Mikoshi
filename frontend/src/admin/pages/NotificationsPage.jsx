import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../components/AuthProvider';

export default function NotificationsPage() {
  const { sessionToken } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    features: ['']
  });

  useEffect(() => {
    fetchNotifications();
  }, [sessionToken]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/notifications`, {
        headers: { 'Authorization': sessionToken }
      });
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    
    // Filter out empty features
    const cleanedFeatures = formData.features.filter(f => f.trim() !== '');
    
    try {
      const url = editingId 
        ? `${window.API_BASE_URL}/api/admin/notifications/${editingId}`
        : `${window.API_BASE_URL}/api/admin/notifications`;
      
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Authorization': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          features: cleanedFeatures
        })
      });

      if (response.ok) {
        fetchNotifications();
        resetForm();
        setShowCreateForm(false);
        setEditingId(null);
      }
    } catch (error) {
      console.error('Error saving notification:', error);
    }
  };

  const handleActivate = async (id) => {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/notifications/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: true })
      });

      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error activating notification:', error);
    }
  };

  const handleDeactivate = async (id) => {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/notifications/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: false })
      });

      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error deactivating notification:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;
    
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': sessionToken }
      });

      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleEdit = (notification) => {
    setEditingId(notification.id);
    setFormData({
      title: notification.title,
      message: notification.message,
      features: notification.features.length > 0 ? notification.features : ['']
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      features: ['']
    });
  };

  const addFeature = () => {
    setFormData({
      ...formData,
      features: [...formData.features, '']
    });
  };

  const removeFeature = (index) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index)
    });
  };

  const updateFeature = (index, value) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>System Notifications</h1>
          <p className="text-muted">Manage update notifications shown to users</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowCreateForm(!showCreateForm);
          }}
        >
          <i className="bi bi-plus-circle me-2"></i>
          Create New Notification
        </button>
      </div>

      {showCreateForm && (
        <div className="card mb-4">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">
              {editingId ? 'Edit Notification' : 'Create New Notification'}
            </h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleCreateOrUpdate}>
              <div className="mb-3">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g., Alpha Test Updates"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Message</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  placeholder="Main message to display to users"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Features / Updates</label>
                {formData.features.map((feature, index) => (
                  <div key={index} className="input-group mb-2">
                    <input
                      type="text"
                      className="form-control"
                      value={feature}
                      onChange={(e) => updateFeature(index, e.target.value)}
                      placeholder={`Feature ${index + 1}`}
                    />
                    {formData.features.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() => removeFeature(index)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={addFeature}
                >
                  <i className="bi bi-plus me-1"></i>Add Feature
                </button>
              </div>

              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-save me-2"></i>
                  {editingId ? 'Update' : 'Create'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">All Notifications</h5>
        </div>
        <div className="card-body">
          {notifications.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="bi bi-inbox display-1"></i>
              <p className="mt-3">No notifications created yet</p>
            </div>
          ) : (
            <div className="list-group">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={`list-group-item ${notification.is_active ? 'border-success border-2' : ''}`}
                >
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="flex-grow-1">
                      <h5 className="mb-1">
                        {notification.title}
                        {notification.is_active && (
                          <span className="badge bg-success ms-2">Active</span>
                        )}
                      </h5>
                      <p className="mb-2 text-muted">{notification.message}</p>
                      
                      {notification.features.length > 0 && (
                        <div className="mb-2">
                          <strong className="small">Features:</strong>
                          <ul className="small mb-0 mt-1">
                            {notification.features.map((feature, idx) => (
                              <li key={idx}>{feature}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <small className="text-muted">
                        Created: {new Date(notification.created_at).toLocaleString()} | 
                        Updated: {new Date(notification.updated_at).toLocaleString()}
                      </small>
                    </div>
                    
                    <div className="btn-group ms-3" role="group">
                      {!notification.is_active ? (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleActivate(notification.id)}
                          title="Activate this notification"
                        >
                          <i className="bi bi-check-circle"></i> Activate
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => handleDeactivate(notification.id)}
                          title="Deactivate this notification"
                        >
                          <i className="bi bi-pause-circle"></i> Deactivate
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => handleEdit(notification)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(notification.id)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="alert alert-info mt-4">
        <i className="bi bi-info-circle me-2"></i>
        <strong>Note:</strong> Only one notification can be active at a time. Activating a notification will automatically deactivate all others. Users will see the active notification once per session.
      </div>
    </div>
  );
}
