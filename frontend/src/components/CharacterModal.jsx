
import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import EntityCard from './EntityCard';
import { AuthContext } from './AuthProvider';

export default function CharacterModal({ show, onClose, onSelect }) {
  const { t } = useTranslation();
  const { sessionToken } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('popular');
  const [popularCharacters, setPopularCharacters] = useState([]);
  const [likedCharacters, setLikedCharacters] = useState([]);
  const [myCharacters, setMyCharacters] = useState([]);
  const [recentCharacters, setRecentCharacters] = useState([]);
  const [tabLoading, setTabLoading] = useState({ liked: false, my: false, recent: false });
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

  const tabListStyle = {
    flexShrink: 0,
    borderBottom: '1px solid #e3d9f3',
    gap: '0.35rem',
    flexWrap: 'wrap',
  };

  const tabButtonBaseStyle = {
    cursor: 'pointer',
    fontSize: '0.875rem',
    borderRadius: '0.7rem 0.7rem 0 0',
    padding: isMobile ? '0.45rem 0.7rem' : '0.48rem 0.85rem',
    border: '1px solid transparent',
    borderBottom: 'none',
    transition: 'background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease',
  };

  const tabButtonActiveStyle = {
    ...tabButtonBaseStyle,
    fontWeight: 600,
    color: '#564a7a',
    background: '#efe8fb',
    borderColor: '#d8caef',
  };

  const tabButtonInactiveStyle = {
    ...tabButtonBaseStyle,
    fontWeight: 500,
    color: '#74698f',
    background: '#f7f3fd',
    borderColor: '#e8def6',
  };

  const cardWrapperStyle = {
    width: '100%',
    maxWidth: '100%',
  };

  const cardGridStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))',
    gap: isMobile ? '0.5rem' : '1rem',
    padding: isMobile ? '0 0.25rem' : 0,
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!show) return;
    fetch(`${window.API_BASE_URL}/api/characters/popular`)
      .then(res => res.json())
      .then(data => setPopularCharacters(data.items || []));
  }, [show]);

  useEffect(() => {
    if (!show || activeTab !== 'liked' || !sessionToken) return;
    setTabLoading(prev => ({ ...prev, liked: true }));
    fetch(`${window.API_BASE_URL}/api/characters-liked?sort=newest&page=1&page_size=50`, {
      headers: { 'Authorization': sessionToken },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setLikedCharacters(data?.items || (Array.isArray(data) ? data : []));
        setTabLoading(prev => ({ ...prev, liked: false }));
      })
      .catch(() => setTabLoading(prev => ({ ...prev, liked: false })));
  }, [show, activeTab, sessionToken]);

  useEffect(() => {
    if (!show || activeTab !== 'my' || !sessionToken) return;
    setTabLoading(prev => ({ ...prev, my: true }));
    fetch(`${window.API_BASE_URL}/api/characters-created?sort=newest&page=1&page_size=50`, {
      headers: { 'Authorization': sessionToken },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setMyCharacters(data?.items || (Array.isArray(data) ? data : []));
        setTabLoading(prev => ({ ...prev, my: false }));
      })
      .catch(() => setTabLoading(prev => ({ ...prev, my: false })));
  }, [show, activeTab, sessionToken]);

  useEffect(() => {
    if (!show || activeTab !== 'recent' || !sessionToken) return;
    setTabLoading(prev => ({ ...prev, recent: true }));
    fetch(`${window.API_BASE_URL}/api/characters-recent-chats?page=1&page_size=50`, {
      headers: { 'Authorization': sessionToken },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setRecentCharacters(data?.items || (Array.isArray(data) ? data : []));
        setTabLoading(prev => ({ ...prev, recent: false }));
      })
      .catch(() => setTabLoading(prev => ({ ...prev, recent: false })));
  }, [show, activeTab, sessionToken]);

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
    <div
      onClick={onClose}
      className="modal d-block"
      tabIndex="-1"
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: isMobile ? '1.25rem 0.75rem 0.75rem' : '2.5rem 2.5rem 1.25rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-dialog modal-lg"
        style={{
          width: '100%',
          maxWidth: isMobile ? 'min(95vw, 30rem)' : 'min(66rem, calc(100vw - 7rem))',
          margin: 'auto',
          maxHeight: '90vh',
          display: 'flex',
        }}
      >
        <div className="modal-content" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', width: '100%', borderRadius: 14, border: '1px solid #ece9f4', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.1)' }}>
          <div className="modal-header" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h5 className="modal-title" style={{ fontWeight: 800, marginBottom: 0 }}>{t('character_modal.title')}</h5>
            </div>
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
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, padding: isMobile ? '1rem' : '1.25rem 1.5rem' }}>
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
                <div style={cardGridStyle}>
                  {searchResults.length > 0 ? (
                    searchResults.map(character => (
                      <div key={character.id} style={cardWrapperStyle}>
                        <EntityCard type="character" entity={character} onClick={() => onSelect(character)} />
                      </div>
                    ))
                  ) : (
                    <div className="text-muted text-center" style={{ width: '100%', gridColumn: '1 / -1' }}>{t('character_modal.no_characters_found')}</div>
                  )}
                </div>
              )
            ) : (
              <>
                <ul className="nav nav-tabs mb-3" style={tabListStyle}>
                  {[
                    { key: 'popular', label: '热门' },
                    { key: 'recent', label: '最近' },
                    { key: 'liked', label: '喜欢的角色' },
                    { key: 'my', label: '我的角色' },
                  ].map(tab => (
                    <li key={tab.key} className="nav-item">
                      <button
                        className={`nav-link${activeTab === tab.key ? ' active' : ''}`}
                        style={activeTab === tab.key ? tabButtonActiveStyle : tabButtonInactiveStyle}
                        onClick={() => setActiveTab(tab.key)}
                        onMouseEnter={(e) => {
                          if (activeTab === tab.key) return;
                          e.currentTarget.style.background = '#f1ebfb';
                          e.currentTarget.style.color = '#665a86';
                          e.currentTarget.style.borderColor = '#ddd0f1';
                        }}
                        onMouseLeave={(e) => {
                          if (activeTab === tab.key) return;
                          e.currentTarget.style.background = tabButtonInactiveStyle.background;
                          e.currentTarget.style.color = tabButtonInactiveStyle.color;
                          e.currentTarget.style.borderColor = tabButtonInactiveStyle.borderColor;
                        }}
                      >
                        {tab.label}
                      </button>
                    </li>
                  ))}
                </ul>
                {activeTab === 'popular' && (
                  <div style={cardGridStyle}>
                    {popularCharacters.length > 0 ? (
                      popularCharacters.map(character => (
                        <div key={character.id} style={cardWrapperStyle}>
                          <EntityCard type="character" entity={character} onClick={() => onSelect(character)} />
                        </div>
                      ))
                    ) : (
                      <div className="text-muted text-center" style={{ width: '100%', gridColumn: '1 / -1' }}>{t('character_modal.no_popular_characters')}</div>
                    )}
                  </div>
                )}
                {activeTab === 'liked' && (
                  tabLoading.liked ? (
                    <div className="text-center text-muted">{t('character_modal.searching')}</div>
                  ) : (
                    <div style={cardGridStyle}>
                      {likedCharacters.length > 0 ? (
                        likedCharacters.map(character => (
                          <div key={character.id} style={cardWrapperStyle}>
                            <EntityCard type="character" entity={character} onClick={() => onSelect(character)} />
                          </div>
                        ))
                      ) : (
                        <div className="text-muted text-center" style={{ width: '100%', gridColumn: '1 / -1' }}>暂无喜欢的角色</div>
                      )}
                    </div>
                  )
                )}
                {activeTab === 'recent' && (
                  tabLoading.recent ? (
                    <div className="text-center text-muted">{t('character_modal.searching')}</div>
                  ) : (
                    <div style={cardGridStyle}>
                      {recentCharacters.length > 0 ? (
                        recentCharacters.map(character => (
                          <div key={character.id} style={cardWrapperStyle}>
                            <EntityCard type="character" entity={character} onClick={() => onSelect(character)} />
                          </div>
                        ))
                      ) : (
                        <div className="text-muted text-center" style={{ width: '100%', gridColumn: '1 / -1' }}>暂无最近聊天的角色</div>
                      )}
                    </div>
                  )
                )}
                {activeTab === 'my' && (
                  tabLoading.my ? (
                    <div className="text-center text-muted">{t('character_modal.searching')}</div>
                  ) : (
                    <div style={cardGridStyle}>
                      {myCharacters.length > 0 ? (
                        myCharacters.map(character => (
                          <div key={character.id} style={cardWrapperStyle}>
                            <EntityCard type="character" entity={character} onClick={() => onSelect(character)} />
                          </div>
                        ))
                      ) : (
                        <div className="text-muted text-center" style={{ width: '100%', gridColumn: '1 / -1' }}>暂无创建的角色</div>
                      )}
                    </div>
                  )
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              style={{ ...neutralButtonStyle, borderRadius: '1.2rem', fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem', padding: isMobile ? '0.45rem 0.95rem' : '0.5rem 1.1rem' }}
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
