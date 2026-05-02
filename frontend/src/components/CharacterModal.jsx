
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import EntityCard from './EntityCard';

export default function CharacterModal({ show, onClose, onSelect }) {
  const { t } = useTranslation();
  const [popularCharacters, setPopularCharacters] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

  const baseButtonStyle = {
    borderRadius: '0.5rem',
    border: '1px solid #d8dbe2',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
  };

  const neutralButtonStyle = {
    ...baseButtonStyle,
    background: '#f3f4f6',
    border: '1px solid #e1e5eb',
    color: '#4b5563',
  };

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

  const modalContent = (
    <div onClick={onClose} className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '1rem' : '2rem' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: isMobile ? '95vw' : '600px', width: '100%', margin: 'auto' }}>
        <div className="modal-content" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 14, border: '1px solid #ece9f4', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.1)' }}>
          <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h5 className="modal-title">{t('character_modal.title')}</h5>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...neutralButtonStyle,
                width: 30,
                height: 30,
                marginLeft: 'auto',
                flexShrink: 0,
                borderRadius: '50%',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.95rem',
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#eceff4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
              }}
              aria-label={t('character_modal.cancel')}
            >
              <i className="bi bi-x"></i>
            </button>
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
            <button
              type="button"
              onClick={onClose}
              style={{ ...neutralButtonStyle, padding: '0.45rem 0.95rem' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#eceff4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
              }}
            >
              {t('character_modal.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
