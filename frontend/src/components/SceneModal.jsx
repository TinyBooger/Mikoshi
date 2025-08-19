

import React, { useState, useEffect } from 'react';
import SceneCard from './SceneCard';

export default function SceneModal({ show, onClose, onSelect }) {
  const [popularScenes, setPopularScenes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;
    // Fetch popular scenes on open
    fetch('/api/scenes/popular')
      .then(res => res.json())
      .then(setPopularScenes);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    // Search scenes by name (search on type)
    const controller = new AbortController();
    fetch(`/api/scenes/?search=${encodeURIComponent(searchTerm)}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        setSearchResults(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, [searchTerm, show]);

  if (!show) return null;

  return (
    <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Select Scene</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <input
              type="text"
              className="form-control mb-3"
              placeholder="Search scenes by name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm.trim() ? (
              loading ? (
                <div className="text-center text-muted">Searching...</div>
              ) : (
                <div className="d-flex flex-wrap justify-content-start">
                  {searchResults.length > 0 ? (
                    searchResults.map(scene => (
                      <div key={scene.id} onClick={() => onSelect(scene)} style={{ cursor: 'pointer' }}>
                        <SceneCard scene={scene} />
                      </div>
                    ))
                  ) : (
                    <div className="text-muted w-100 text-center">No scenes found.</div>
                  )}
                </div>
              )
            ) : (
              <>
                <h6 className="mb-2">Popular Scenes</h6>
                <div className="d-flex flex-wrap justify-content-start">
                  {popularScenes.length > 0 ? (
                    popularScenes.map(scene => (
                      <div key={scene.id} onClick={() => onSelect(scene)} style={{ cursor: 'pointer' }}>
                        <SceneCard scene={scene} />
                      </div>
                    ))
                  ) : (
                    <div className="text-muted w-100 text-center">No popular scenes found.</div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
