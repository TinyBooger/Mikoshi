
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import EntityCard from './EntityCard';

export default function CharacterModal({ show, onClose, onSelect }) {
  const { t } = useTranslation();
  const [popularCharacters, setPopularCharacters] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      <div className="modal-dialog modal-lg" style={{ maxWidth: isMobile ? '98vw' : undefined }}>
        <div className="modal-content" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header">
            <h5 className="modal-title">{t('character_modal.title')}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, padding: isMobile ? '1rem 0.5rem' : '1rem' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: isMobile ? '0.5rem' : '1rem', justifyItems: 'stretch', padding: isMobile ? '0 0.25rem' : 0 }}>
                  {searchResults.length > 0 ? (
                    searchResults.map(character => (
                      <EntityCard key={character.id} type="character" entity={character} onClick={() => onSelect(character)} />
                    ))
                  ) : (
                    <div className="text-muted text-center" style={{ gridColumn: '1 / -1' }}>{t('character_modal.no_characters_found')}</div>
                  )}
                </div>
              )
            ) : (
              <>
                <h6 className="mb-2">{t('character_modal.popular_characters')}</h6>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: isMobile ? '0.5rem' : '1rem', justifyItems: 'stretch', padding: isMobile ? '0 0.25rem' : 0 }}>
                  {popularCharacters.length > 0 ? (
                    popularCharacters.map(character => (
                      <EntityCard key={character.id} type="character" entity={character} onClick={() => onSelect(character)} />
                    ))
                  ) : (
                    <div className="text-muted text-center" style={{ gridColumn: '1 / -1' }}>{t('character_modal.no_popular_characters')}</div>
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
