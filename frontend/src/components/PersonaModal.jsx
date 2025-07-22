import React, { useState } from 'react';

export default function PersonaModal({ 
  show, 
  onClose, 
  onSave, 
  currentPersona = null 
}) {
  const [personaName, setPersonaName] = useState(currentPersona?.name || '');
  const [personaDescription, setPersonaDescription] = useState(
    currentPersona?.description || ''
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: personaName,
      description: personaDescription
    });
  };

  return (
    <div className={`modal ${show ? 'd-block' : ''}`} tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h5 className="modal-title">
              {currentPersona ? 'Edit Persona' : 'Create New Persona'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-control"
                value={personaName}
                onChange={e => setPersonaName(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Persona Description</label>
              <textarea
                className="form-control"
                rows="5"
                value={personaDescription}
                onChange={e => setPersonaDescription(e.target.value)}
                required
              />
              <small className="text-muted">
                This will be appended to the system message when chatting with characters.
              </small>
            </div>
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn btn-primary">
              {currentPersona ? 'Save Changes' : 'Create Persona'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}