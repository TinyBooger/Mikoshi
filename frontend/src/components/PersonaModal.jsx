
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PersonaCard from './PersonaCard';

export default function PersonaModal({ show, onClose, onSelect }) {
  const { t } = useTranslation();
  const [popularPersonas, setPopularPersonas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;
    // Fetch popular personas on open
    fetch(`${window.API_BASE_URL}/api/personas/popular`)
      .then(res => res.json())
      .then(setPopularPersonas);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    // Search personas by name (search on type)
    const controller = new AbortController();
    fetch(`${window.API_BASE_URL}/api/personas/?search=${encodeURIComponent(searchTerm)}`, { signal: controller.signal })
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
            <h5 className="modal-title">{t('persona_modal.title')}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <input
              type="text"
              className="form-control mb-3"
              placeholder={t('persona_modal.search_placeholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm.trim() ? (
              loading ? (
                <div className="text-center text-muted">{t('persona_modal.searching')}</div>
              ) : (
                <div className="d-flex flex-wrap justify-content-start">
                  {searchResults.length > 0 ? (
                    searchResults.map(persona => (
                      <div key={persona.id} onClick={() => onSelect(persona)} style={{ cursor: 'pointer' }}>
                        <PersonaCard persona={persona} />
                      </div>
                    ))
                  ) : (
                    <div className="text-muted w-100 text-center">{t('persona_modal.no_personas_found')}</div>
                  )}
                </div>
              )
            ) : (
              <>
                <h6 className="mb-2">{t('persona_modal.popular_personas')}</h6>
                <div className="d-flex flex-wrap justify-content-start">
                  {popularPersonas.length > 0 ? (
                    popularPersonas.map(persona => (
                      <div key={persona.id} onClick={() => onSelect(persona)} style={{ cursor: 'pointer' }}>
                        <PersonaCard persona={persona} />
                      </div>
                    ))
                  ) : (
                    <div className="text-muted w-100 text-center">{t('persona_modal.no_popular_personas')}</div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('persona_modal.cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}