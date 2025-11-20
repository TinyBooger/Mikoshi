

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import EntityCard from './EntityCard';

export default function SceneModal({ show, onClose, onSelect }) {
  const { t } = useTranslation();
  const [popularScenes, setPopularScenes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;
    // Fetch popular scenes on open
    fetch(`${window.API_BASE_URL}/api/scenes/popular`)
      .then(res => res.json())
      .then(data => setPopularScenes(data.items || []));
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
    fetch(`${window.API_BASE_URL}/api/scenes/search?q=${encodeURIComponent(searchTerm)}`, { signal: controller.signal })
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
            <h5 className="modal-title">{t('scene_modal.title')}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <input
              type="text"
              className="form-control mb-3"
              placeholder={t('scene_modal.search_placeholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm.trim() ? (
              loading ? (
                <div className="text-center text-muted">{t('scene_modal.searching')}</div>
              ) : (
                <div className="d-flex flex-wrap justify-content-start">
                  {searchResults.length > 0 ? (
                    searchResults.map(scene => (
                      <div key={scene.id} onClick={() => onSelect(scene)} style={{ cursor: 'pointer' }}>
                        <EntityCard type="scene" entity={scene} />
                      </div>
                    ))
                  ) : (
                    <div className="text-muted w-100 text-center">{t('scene_modal.no_scenes_found')}</div>
                  )}
                </div>
              )
            ) : (
              <>
                <h6 className="mb-2">{t('scene_modal.popular_scenes')}</h6>
                <div className="d-flex flex-wrap justify-content-start">
                  {popularScenes.length > 0 ? (
                    popularScenes.map(scene => (
                      <div key={scene.id} onClick={() => onSelect(scene)} style={{ cursor: 'pointer' }}>
                        <EntityCard type="scene" entity={scene} />
                      </div>
                    ))
                  ) : (
                    <div className="text-muted w-100 text-center">{t('scene_modal.no_popular_scenes')}</div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('scene_modal.cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
