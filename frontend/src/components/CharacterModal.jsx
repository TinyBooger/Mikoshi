
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import EntityCard from './EntityCard';

export default function CharacterModal({ show, onClose, onSelect }) {
  const { t } = useTranslation();
  const [popularCharacters, setPopularCharacters] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;
    // Fetch popular characters on open
    fetch(`${window.API_BASE_URL}/api/characters/popular`)
      .then(res => res.json())
      .then(data => setPopularCharacters(data.items || []));
  }, [show]);

  useEffect(() => {
    if (!show) return;
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    fetch(`${window.API_BASE_URL}/api/characters/search?q=${encodeURIComponent(searchTerm)}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        setSearchResults(data.items || []);
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
            <h5 className="modal-title">{t('character_modal.title')}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <input
              type="text"
              className="form-control mb-3"
              placeholder={t('character_modal.search_placeholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm.trim() ? (
              loading ? (
                <div className="text-center text-muted">{t('character_modal.searching')}</div>
              ) : (
                <div className="d-flex flex-wrap justify-content-start">
                  {searchResults.length > 0 ? (
                    searchResults.map(character => (
                      <div key={character.id} onClick={() => onSelect(character)} style={{ cursor: 'pointer' }}>
                        <EntityCard type="character" entity={character} />
                      </div>
                    ))
                  ) : (
                    <div className="text-muted w-100 text-center">{t('character_modal.no_characters_found')}</div>
                  )}
                </div>
              )
            ) : (
              <>
                <h6 className="mb-2">{t('character_modal.popular_characters')}</h6>
                <div className="d-flex flex-wrap justify-content-start">
                  {popularCharacters.length > 0 ? (
                    popularCharacters.map(character => (
                      <div key={character.id} onClick={() => onSelect(character)} style={{ cursor: 'pointer' }}>
                        <EntityCard type="character" entity={character} />
                      </div>
                    ))
                  ) : (
                    <div className="text-muted w-100 text-center">{t('character_modal.no_popular_characters')}</div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('character_modal.cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
