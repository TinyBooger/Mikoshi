import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import EntityCard from './EntityCard';
import defaultPic from '../assets/images/default-picture.png';

export default function SceneCharacterSelectModal({
  show,
  loading,
  selectedScene,
  onSelectCharacter,
  setSelectedCharacter,
  selectedCharacter,
  onStartChat,
  onCancel,
  isMobile
}) {
  const { t } = useTranslation();
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

  const lavenderButtonStyle = {
    ...baseButtonStyle,
    background: '#ede7f7',
    border: '1px solid #ddd4ef',
    color: '#5f567f',
  };

  if (!show) return null;

  if (loading) {
    const loadingContent = (
      <div
        className="modal"
        tabIndex="-1"
        style={{
          backgroundColor: 'rgba(0,0,0,0.5)',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1050,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="modal-dialog modal-lg" style={{ maxWidth: isMobile ? '98vw' : undefined, margin: 'auto' }}>
          <div className="modal-content" style={{ maxHeight: '96vh', display: 'flex', flexDirection: 'column', width: '100%', borderRadius: 14, border: '1px solid #ece9f4', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.1)' }}>
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h5 className="modal-title">{t('scene_select_modal.preparing')}</h5>
              <button
                type="button"
                onClick={onCancel}
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
                aria-label={t('scene_select_modal.cancel')}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>
            <div className="modal-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <span className="spinner-border spinner-border-lg" style={{ color: '#18191a', marginRight: 12 }}></span>
              <span style={{ fontWeight: 600, fontSize: '1.08rem', color: '#232323' }}>{t('scene_select_modal.loading')}</span>
            </div>
          </div>
        </div>
      </div>
    );
    return createPortal(loadingContent, document.body);
  }

  const sceneImg = selectedScene?.picture
    ? `${window.API_BASE_URL.replace(/\/$/, '')}/${selectedScene.picture.replace(/^\//, '')}`
    : defaultPic;

  const cardStyle = (selected) => ({
    width: isMobile ? '100%' : 260,
    height: isMobile ? 140 : 240,
    borderRadius: isMobile ? '0.875rem' : '1.2rem',
    background: '#f5f6fa',
    border: '2px dashed #e9ecef',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: selected ? '0 2px 8px rgba(24,25,26,0.08)' : 'none',
    position: 'relative',
    transition: 'border 0.18s, box-shadow 0.18s',
    padding: 0,
    minWidth: 0,
    minHeight: 0,
    flexShrink: 0,
  });

  const removeBtnStyle = {
    position: 'absolute',
    top: isMobile ? 6 : 8,
    right: isMobile ? 6 : 8,
    width: isMobile ? 24 : 28,
    height: isMobile ? 24 : 28,
    border: 'none',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.08)',
    color: '#888',
    fontWeight: 700,
    fontSize: isMobile ? 16 : 18,
    cursor: 'pointer',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  };

  const modalContent = (
    <div
      className="modal"
      tabIndex="-1"
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="modal-dialog modal-lg" style={{ maxWidth: isMobile ? '95vw' : 760, margin: 'auto', maxHeight: '90vh', display: 'flex' }}>
        <div className="modal-content" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', width: '100%', borderRadius: 14, border: '1px solid #ece9f4', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.1)' }}>
          <div className="modal-header" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h5 className="modal-title" style={{ fontWeight: 800 }}>
              {selectedScene?.name
                ? t('scene_select_modal.title', { scene: selectedScene.name })
                : t('scene_select_modal.title_fallback')}
            </h5>
            <button
              type="button"
              onClick={onCancel}
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
              aria-label={t('scene_select_modal.cancel')}
            >
              <i className="bi bi-x"></i>
            </button>
          </div>
          <div
            className="modal-body"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: isMobile ? '1rem' : '1.25rem 1.5rem',
              minHeight: 0,
            }}
          >
            {/* Scene summary */}
            {selectedScene && (
              <div style={{
                display: 'flex',
                gap: isMobile ? 12 : 16,
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: isMobile ? 12 : 16,
                background: '#fff',
                border: '1px solid #e9ecef',
                borderRadius: 14,
                padding: isMobile ? '0.6rem' : '0.8rem 1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}>
                <img
                  src={sceneImg}
                  alt={selectedScene?.name || 'Scene'}
                  style={{
                    width: isMobile ? 64 : 80,
                    height: isMobile ? 64 : 80,
                    borderRadius: 12,
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: '1px solid #e9ecef'
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: isMobile ? '1rem' : '1.05rem' }}>
                    {selectedScene?.name || t('scene_select_modal.scene')}
                  </div>
                  {selectedScene?.intro && (
                    <div style={{ marginTop: 4, color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.35 }}>
                      {selectedScene.intro}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div style={{ textAlign: 'center', color: '#374151', marginBottom: 10, fontWeight: 600 }}>
              {t('scene_select_modal.prompt')}
            </div>

            {/* Character chooser */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={cardStyle(selectedCharacter)}
                onClick={() => { onSelectCharacter && onSelectCharacter(); }}
              >
                {selectedCharacter && (
                  <button
                    type="button"
                    style={removeBtnStyle}
                    title={t('scene_select_modal.remove_character')}
                    onClick={e => { e.stopPropagation(); if (setSelectedCharacter) setSelectedCharacter(null); }}
                  >
                    ×
                  </button>
                )}
                {selectedCharacter ? (
                  <EntityCard type="character" entity={selectedCharacter} disableClick={true} compact={true} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? '1rem' : '0.75rem', padding: isMobile ? '0 1rem' : 0 }}>
                    <i className="bi bi-person" style={{ fontSize: isMobile ? 32 : 48, color: '#bbb' }}></i>
                    <div style={{ fontWeight: 600, fontSize: isMobile ? '0.95rem' : '1.02rem', color: '#888', textAlign: 'center' }}>{t('scene_select_modal.select_character')}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer d-flex justify-content-center" style={{ gap: isMobile ? 8 : 16, padding: isMobile ? '0.75rem 1rem' : '1rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ ...neutralButtonStyle, borderRadius: '1.2rem', fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem', padding: isMobile ? '0.45rem 0.95rem' : '0.5rem 1.1rem' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#eceff4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
              }}
            >
              {t('scene_select_modal.cancel')}
            </button>
            <button
              type="button"
              onClick={onStartChat}
              style={{ ...lavenderButtonStyle, borderRadius: '1.2rem', fontWeight: 700, fontSize: isMobile ? '0.92rem' : '0.98rem', padding: isMobile ? '0.45rem 1rem' : '0.5rem 1.2rem', opacity: selectedCharacter ? 1 : 0.55, cursor: selectedCharacter ? 'pointer' : 'not-allowed' }}
              onMouseEnter={(e) => {
                if (!selectedCharacter) return;
                e.currentTarget.style.background = '#e7e0f4';
                e.currentTarget.style.color = '#554d73';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ede7f7';
                e.currentTarget.style.color = '#5f567f';
              }}
              disabled={!selectedCharacter}
            >
              {t('scene_select_modal.start_chat')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
