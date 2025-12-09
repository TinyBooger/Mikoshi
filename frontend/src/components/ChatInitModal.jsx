import React from 'react';
import { useTranslation } from 'react-i18next';

import EntityCard from '../components/EntityCard';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';


export default function ChatInitModal({
  show,
  loading,
  onSelectCharacter,
  onSelectPersona,
  onSelectScene,
  setSelectedCharacter,
  setSelectedPersona,
  setSelectedScene,
  setPersonaId,
  setSceneId,
  selectedCharacter,
  selectedPersona,
  selectedScene,
  onStartChat,
  onCancel,
  isMobile
}) {
  const { t } = useTranslation();
  if (!show) return null;

  if (loading) {
    return (
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
          <div className="modal-content" style={{ maxHeight: '96vh', display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div className="modal-header">
              <h5 className="modal-title">{t('chat_init_modal.title')}</h5>
            </div>
            <div className="modal-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <span className="spinner-border spinner-border-lg" style={{ color: '#18191a', marginRight: 12 }}></span>
              <span style={{ fontWeight: 600, fontSize: '1.08rem', color: '#232323' }}>{t('chat_init_modal.loading')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Responsive card sizing
  const CARD_WIDTH = isMobile ? '100%' : 180;
  const CARD_HEIGHT = isMobile ? 140 : 250;

  // Vertical layout on mobile, horizontal on desktop
  const cardsContainerStyle = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: isMobile ? '1rem' : '2rem',
    justifyContent: 'center',
    alignItems: isMobile ? 'stretch' : 'center',
    margin: 0,
    width: '100%',
    padding: isMobile ? '1rem' : '2rem 0',
  };

  const cardStyle = (selected) => ({
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
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

  // Remove button style
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

  return (
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
        <div className="modal-content" style={{ maxHeight: '96vh', display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div className="modal-header">
            <h5 className="modal-title">{t('chat_init_modal.title')}</h5>
          </div>
          <div
            className="modal-body"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingBottom: 0,
              padding: isMobile ? '1rem' : '1.5rem',
              minHeight: 0,
              maxHeight: isMobile ? 'calc(96vh - 140px)' : 'calc(96vh - 120px)',
            }}
          >
            <div style={cardsContainerStyle}>
              {/* Character Card/Placeholder */}
              <div
                style={cardStyle(selectedCharacter)}
                onClick={() => { onSelectCharacter(); }}
              >
                {selectedCharacter && (
                  <button
                    type="button"
                    style={removeBtnStyle}
                    title={t('chat_init_modal.remove_character')}
                    onClick={e => { e.stopPropagation(); if (setSelectedCharacter) setSelectedCharacter(null); }}
                  >
                    ×
                  </button>
                )}
                {selectedCharacter ? (
                  <EntityCard type="character" entity={selectedCharacter} disableClick={true} compact={true} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: 'center', gap: isMobile ? '1rem' : '0.75rem', padding: isMobile ? '0 1rem' : 0 }}>
                    <i className="bi bi-person" style={{ fontSize: isMobile ? 32 : 48, color: '#bbb' }}></i>
                    <div style={{ fontWeight: 600, fontSize: isMobile ? '0.95rem' : '1.02rem', color: '#888', textAlign: isMobile ? 'left' : 'center' }}>{t('chat_init_modal.select_character')}</div>
                  </div>
                )}
              </div>
              {/* Persona Card/Placeholder */}
              <div
                style={cardStyle(selectedPersona)}
                onClick={() => { onSelectPersona(); }}
              >
                {selectedPersona && (
                  <button
                    type="button"
                    style={removeBtnStyle}
                    title={t('chat_init_modal.remove_persona')}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedPersona(null);
                      if (setPersonaId) setPersonaId(null);
                    }}
                  >
                    ×
                  </button>
                )}
                {selectedPersona ? (
                  <EntityCard type="persona" entity={selectedPersona} disableClick={true} compact={true} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: 'center', gap: isMobile ? '1rem' : '0.75rem', padding: isMobile ? '0 1rem' : 0 }}>
                    <i className="bi bi-person-badge" style={{ fontSize: isMobile ? 32 : 48, color: '#bbb' }}></i>
                    <div style={{ fontWeight: 600, fontSize: isMobile ? '0.95rem' : '1.02rem', color: '#888', textAlign: isMobile ? 'left' : 'center' }}>{t('chat_init_modal.select_persona')}</div>
                  </div>
                )}
              </div>
              {/* Scene Card/Placeholder */}
              <div
                style={cardStyle(selectedScene)}
                onClick={() => { onSelectScene(); }}
              >
                {selectedScene && (
                  <button
                    type="button"
                    style={removeBtnStyle}
                    title={t('chat_init_modal.remove_scene')}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedScene(null);
                      if (setSceneId) setSceneId(null);
                    }}
                  >
                    ×
                  </button>
                )}
                {selectedScene ? (
                  <EntityCard type="scene" entity={selectedScene} disableClick={true} compact={true} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: 'center', gap: isMobile ? '1rem' : '0.75rem', padding: isMobile ? '0 1rem' : 0 }}>
                    <i className="bi bi-easel" style={{ fontSize: isMobile ? 32 : 48, color: '#bbb' }}></i>
                    <div style={{ fontWeight: 600, fontSize: isMobile ? '0.95rem' : '1.02rem', color: '#888', textAlign: isMobile ? 'left' : 'center' }}>{t('chat_init_modal.select_scene')}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer d-flex justify-content-center" style={{ gap: isMobile ? 8 : 16, padding: isMobile ? '0.75rem 1rem' : '1rem' }}>
            <SecondaryButton
              onClick={onCancel}
              isMobile={isMobile}
              style={{ borderRadius: '1.6rem', fontWeight: 600, fontSize: isMobile ? '0.95rem' : '1.02rem', paddingTop: isMobile ? 6 : 8, paddingBottom: isMobile ? 6 : 8, paddingLeft: isMobile ? 16 : 20, paddingRight: isMobile ? 16 : 20 }}
            >
              {t('chat_init_modal.cancel')}
            </SecondaryButton>
            <PrimaryButton
              onClick={onStartChat}
              isMobile={isMobile}
              style={{ borderRadius: '1.6rem', fontWeight: 700, fontSize: isMobile ? '1rem' : '1.08rem', paddingTop: isMobile ? 6 : 8, paddingBottom: isMobile ? 6 : 8, paddingLeft: isMobile ? 20 : 24, paddingRight: isMobile ? 20 : 24 }}
              disabled={!selectedCharacter}
            >
              {t('chat_init_modal.start_chat')}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
