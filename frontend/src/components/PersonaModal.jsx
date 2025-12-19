
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';

export default function PersonaModal({ show, onClose, onSelect, sessionToken, refreshUserData, userData }) {
  const { t } = useTranslation();
  const [userPersonas, setUserPersonas] = useState([]);
  const [popularPersonas, setPopularPersonas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [defaultPersonaId, setDefaultPersonaId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!show) return;
    // Sync the current default persona ID from userData
    setDefaultPersonaId(userData?.default_persona_id || null);
    // Fetch user's created personas and popular personas on open
    Promise.all([
      fetch(`${window.API_BASE_URL}/api/personas-created`, {
        headers: sessionToken ? { 'Authorization': sessionToken } : {}
      })
        .then(res => res.json())
        .then(data => setUserPersonas(data.items || []))
        .catch(() => setUserPersonas([])),
      fetch(`${window.API_BASE_URL}/api/personas/popular`)
        .then(res => res.json())
        .then(data => setPopularPersonas(data.items || []))
        .catch(() => setPopularPersonas([]))
    ]);
  }, [show, sessionToken, userData?.default_persona_id]);

  const handleSetDefault = async (e, personaId) => {
    e.stopPropagation();
    try {
      // If clicking the already default persona, unset it
      if (defaultPersonaId === personaId) {
        const response = await fetch(`${window.API_BASE_URL}/api/personas/unset-default`, {
          method: 'POST',
          headers: sessionToken ? { 'Authorization': sessionToken } : {}
        });
        if (response.ok) {
          setDefaultPersonaId(null);
        } else {
          alert('Failed to unset persona as default');
        }
      } else {
        const response = await fetch(`${window.API_BASE_URL}/api/personas/${personaId}/set-default`, {
          method: 'POST',
          headers: sessionToken ? { 'Authorization': sessionToken } : {}
        });
        if (response.ok) {
          setDefaultPersonaId(personaId);
        } else {
          alert('Failed to set persona as default');
        }
      }
    } catch (error) {
      console.error('Error setting default persona:', error);
      alert('Error setting default persona');
    }
  };

  const handlePersonaToggle = (personaId) => {
    // Toggle persona selection
    setSelectedPersonaId(selectedPersonaId === personaId ? null : personaId);
  };

  const handleConfirm = () => {
    // Call onSelect with the selected persona (or null if unselected)
    if (selectedPersonaId) {
      const persona = userPersonas.find(p => p.id === selectedPersonaId) || 
                     popularPersonas.find(p => p.id === selectedPersonaId) ||
                     searchResults.find(p => p.id === selectedPersonaId);
      if (persona) {
        onSelect(persona);
        onClose();
      }
    } else {
      onSelect(null);
      onClose();
    }
  };

  const handleUnsetDefault = async () => {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/personas/unset-default`, {
        method: 'POST',
        headers: sessionToken ? { 'Authorization': sessionToken } : {}
      });
      if (response.ok) {
        setDefaultPersonaId(null);
      } else {
        alert('Failed to unset persona as default');
      }
    } catch (error) {
      console.error('Error unsetting default persona:', error);
      alert('Error unsetting default persona');
    }
  };

  const handleDeletePersona = async (e, personaId) => {
    e.stopPropagation();
    setPendingDeleteId(personaId);
  };

  const confirmDelete = async (personaId) => {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/personas/${personaId}`, {
        method: 'DELETE',
        headers: sessionToken ? { 'Authorization': sessionToken } : {}
      });
      if (response.ok) {
        setUserPersonas(userPersonas.filter(p => p.id !== personaId));
        setPendingDeleteId(null);
        if (defaultPersonaId === personaId) {
          setDefaultPersonaId(null);
        }
      } else {
        alert('Failed to delete persona');
      }
    } catch (error) {
      console.error('Error deleting persona:', error);
      alert('Error deleting persona');
    }
  };

  const cancelDelete = () => {
    setPendingDeleteId(null);
  };

  useEffect(() => {
    if (!show) return;
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    // Search personas by name
    const controller = new AbortController();
    fetch(`${window.API_BASE_URL}/api/personas/?search=${encodeURIComponent(searchTerm)}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        setSearchResults(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, [searchTerm, show]);

  if (!show) return null;

  const modalContent = (
    <div onClick={onClose} className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '1rem' : '2rem' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: isMobile ? '95vw' : '600px', width: '100%', margin: 'auto' }}>
        <div className="modal-content" style={{ maxHeight: isMobile ? '85vh' : '80vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header">
            <h5 className="modal-title">{t('persona_modal.title')}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, padding: isMobile ? '1rem 0.5rem' : '1rem' }}>
            {/* User Personas Section - Always at Top */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h6 className="mb-3" style={{ fontWeight: 700, fontSize: '0.95rem', color: '#232323' }}>{t('persona_modal.my_personas')}</h6>
              {userPersonas.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {userPersonas.map(persona => (
                    <div key={persona.id}>
                      {pendingDeleteId === persona.id ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            padding: '0.75rem',
                            borderRadius: '0.6rem',
                            border: '1px solid #dc3545',
                            backgroundColor: '#ffe6e6'
                          }}
                        >
                          <div style={{ fontSize: '0.88rem', color: '#232323', fontWeight: 500 }}>
                            {t('persona_modal.confirm_delete')}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => confirmDelete(persona.id)}
                              style={{
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.8rem',
                                backgroundColor: '#dc3545',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.4rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c82333'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#dc3545'}
                            >
                              {t('persona_modal.delete')}
                            </button>
                            <button
                              onClick={cancelDelete}
                              style={{
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.8rem',
                                backgroundColor: '#6c757d',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.4rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#5a6268'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#6c757d'}
                            >
                              {t('persona_modal.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => handlePersonaToggle(persona.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: '0.6rem',
                            border: selectedPersonaId === persona.id ? '2px solid #007bff' : '1px solid #e9ecef',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            backgroundColor: selectedPersonaId === persona.id ? '#e7f1ff' : '#fff'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = selectedPersonaId === persona.id ? '#e7f1ff' : '#f9fafb';
                            e.currentTarget.style.borderColor = selectedPersonaId === persona.id ? '#007bff' : '#d1d5db';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = selectedPersonaId === persona.id ? '#e7f1ff' : '#fff';
                            e.currentTarget.style.borderColor = selectedPersonaId === persona.id ? '#007bff' : '#e9ecef';
                          }}
                        >
                          <img
                            src={persona.picture
                              ? `${window.API_BASE_URL.replace(/\/$/, '')}/${persona.picture.replace(/^\//, '')}`
                              : `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect fill='%23a28bff' width='40' height='40'/%3E%3C/svg%3E`
                            }
                            alt={persona.name}
                            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#232323', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {persona.name} {defaultPersonaId === persona.id && <span style={{ color: '#7c3aed', fontSize: '0.75rem' }}>★</span>} {selectedPersonaId === persona.id && <span style={{ color: '#007bff', fontSize: '0.75rem' }}>✓</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                            <button
                              onClick={(e) => handleSetDefault(e, persona.id)}
                              style={{
                                padding: '0.4rem 0.6rem',
                                fontSize: '0.75rem',
                                backgroundColor: defaultPersonaId === persona.id ? '#7c3aed' : '#e9ecef',
                                color: defaultPersonaId === persona.id ? '#fff' : '#232323',
                                border: 'none',
                                borderRadius: '0.4rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = defaultPersonaId === persona.id ? '#6d28d9' : '#d1d5db';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = defaultPersonaId === persona.id ? '#7c3aed' : '#e9ecef';
                              }}
                              title={defaultPersonaId === persona.id ? 'Click to unset default' : 'Click to set as default'}
                            >
                              {defaultPersonaId === persona.id ? t('persona_modal.unset_default') : t('persona_modal.set_as_default')}
                            </button>
                            <button
                              onClick={(e) => handleDeletePersona(e, persona.id)}
                              style={{
                                padding: '0.4rem 0.6rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#ffe6e6',
                                color: '#dc3545',
                                border: '1px solid #dc3545',
                                borderRadius: '0.4rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = '#ffc2c2';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = '#ffe6e6';
                              }}
                            >
                              {t('persona_modal.delete')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted text-center" style={{ padding: '1rem', fontSize: '0.88rem' }}>{t('persona_modal.no_personas')}</div>
              )}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid #e9ecef', marginBottom: '1.5rem' }}></div>

            {/* Search Box */}
            <input
              type="text"
              className="form-control mb-3"
              placeholder={t('persona_modal.search_placeholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus={userPersonas.length === 0}
            />

            {/* Search Results or Popular Personas Section */}
            {searchTerm.trim() ? (
              <>
                <h6 className="mb-3" style={{ fontWeight: 700, fontSize: '0.95rem', color: '#232323' }}>{t('persona_modal.search_results')}</h6>
                {loading ? (
                  <div className="text-center text-muted">{t('persona_modal.searching')}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {searchResults.length > 0 ? (
                      searchResults.map(persona => (
                        <div
                          key={persona.id}
                          onClick={() => onSelect(persona)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: '0.6rem',
                            border: '1px solid #e9ecef',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            backgroundColor: '#fff'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                            e.currentTarget.style.borderColor = '#d1d5db';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#fff';
                            e.currentTarget.style.borderColor = '#e9ecef';
                          }}
                        >
                          <img
                            src={persona.picture
                              ? `${window.API_BASE_URL.replace(/\/$/, '')}/${persona.picture.replace(/^\//, '')}`
                              : `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect fill='%23a28bff' width='40' height='40'/%3E%3C/svg%3E`
                              }
                            alt={persona.name}
                            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#232323', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {persona.name}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted text-center">{t('persona_modal.no_personas_found')}</div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <h6 className="mb-3" style={{ fontWeight: 700, fontSize: '0.95rem', color: '#232323' }}>{t('persona_modal.popular_personas')}</h6>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {popularPersonas.length > 0 ? (
                    popularPersonas.map(persona => (
                      <div
                        key={persona.id}
                        onClick={() => onSelect(persona)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.75rem',
                          borderRadius: '0.6rem',
                          border: '1px solid #e9ecef',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          backgroundColor: '#fff'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = '#fff';
                          e.currentTarget.style.borderColor = '#e9ecef';
                        }}
                      >
                        <img
                          src={persona.picture
                            ? `${window.API_BASE_URL.replace(/\/$/, '')}/${persona.picture.replace(/^\//, '')}`
                            : `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect fill='%23a28bff' width='40' height='40'/%3E%3C/svg%3E`
                            }
                          alt={persona.name}
                          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#232323', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {persona.name}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted text-center">{t('persona_modal.no_popular_personas')}</div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('persona_modal.cancel')}</button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm}>{t('persona_modal.confirm')}</button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}