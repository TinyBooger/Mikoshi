
import React, { useState, useEffect } from 'react';
import CharacterCard from './CharacterCard';

export default function CharacterModal({ show, onClose, onSelect }) {
  const [popularCharacters, setPopularCharacters] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;
    // Fetch popular characters on open
    fetch('/api/characters/popular')
      .then(res => res.json())
      .then(setPopularCharacters);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/characters/search?name=${encodeURIComponent(searchTerm)}`, { signal: controller.signal })
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
            <h5 className="modal-title">Select Character</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <input
              type="text"
              className="form-control mb-3"
              placeholder="Search characters by name..."
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
                    searchResults.map(character => (
                      <div key={character.id} onClick={() => onSelect(character)} style={{ cursor: 'pointer' }}>
                        <CharacterCard character={character} />
                      </div>
                    ))
                  ) : (
                    <div className="text-muted w-100 text-center">No characters found.</div>
                  )}
                </div>
              )
            ) : (
              <>
                <h6 className="mb-2">Popular Characters</h6>
                <div className="d-flex flex-wrap justify-content-start">
                  {popularCharacters.length > 0 ? (
                    popularCharacters.map(character => (
                      <div key={character.id} onClick={() => onSelect(character)} style={{ cursor: 'pointer' }}>
                        <CharacterCard character={character} />
                      </div>
                    ))
                  ) : (
                    <div className="text-muted w-100 text-center">No popular characters found.</div>
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
