import React, { useState, useEffect } from 'react';

export default function EditModal({ title, fields, initialData, onSave, onClose }) {
  const [formData, setFormData] = useState(initialData || {});

  useEffect(() => {
    setFormData(initialData || {});
  }, [initialData]);

  const handleChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {fields.map(field => (
                <div className="mb-3" key={field.name}>
                  <label className="form-label fw-bold">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="form-control"
                      value={formData[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      rows={field.rows || 3}
                      required={field.required}
                      readOnly={field.readOnly}
                    />
                  ) : field.type === 'checkbox' ? (
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={formData[field.name] || false}
                        onChange={(e) => handleChange(field.name, e.target.checked)}
                        disabled={field.readOnly}
                      />
                      <label className="form-check-label">{field.helperText}</label>
                    </div>
                  ) : field.type === 'tags' ? (
                    <input
                      type="text"
                      className="form-control"
                      value={Array.isArray(formData[field.name]) ? formData[field.name].join(', ') : ''}
                      onChange={(e) => handleChange(field.name, e.target.value.split(',').map(t => t.trim()).filter(t => t))}
                      placeholder="Enter tags separated by commas"
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      className="form-control"
                      value={formData[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      required={field.required}
                      readOnly={field.readOnly}
                    />
                  )}
                  {field.helperText && field.type !== 'checkbox' && (
                    <small className="form-text text-muted">{field.helperText}</small>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
