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
  const CARD_WIDTH = isMobile ? '46dvw' : 180;
  const CARD_HEIGHT = isMobile ? 'calc(46dvw * 1.32)' : 250;

  // Always horizontal layout; enable horizontal scroll on mobile
  const cardsContainerStyle = {
    display: 'flex',
    flexDirection: 'row',
    gap: isMobile ? '1.2rem' : '2rem',
    justifyContent: 'center',
    alignItems: 'center',
    margin: isMobile ? '1.2rem 0' : '2rem 0',
    width: isMobile ? 'max-content' : '100%',
    overflowX: isMobile ? 'auto' : undefined,
    overflowY: 'hidden',
    padding: isMobile ? '0 0.5rem' : undefined,
  };

  const cardStyle = (selected) => ({
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: '1.2rem',
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
  });

  // Remove button style
  const removeBtnStyle = {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.08)',
    color: '#888',
    fontWeight: 700,
    fontSize: 18,
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
              paddingBottom: 0,
              minHeight: 0,
              maxHeight: isMobile ? 'calc(96vh - 120px)' : 'calc(96vh - 120px)', // header+footer ~120px
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
                  <EntityCard type="character" entity={selectedCharacter} disableClick={true} />
                ) : (
                  <>
                    <i className="bi bi-person" style={{ fontSize: 48, color: '#bbb', marginBottom: 12 }}></i>
                    <div style={{ fontWeight: 600, fontSize: '1.02rem', color: '#888', textAlign: 'center' }}>{t('chat_init_modal.select_character')}</div>
                  </>
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
                    onClick={e => { e.stopPropagation(); if (setSelectedPersona) setSelectedPersona(null); }}
                  >
                    ×
                  </button>
                )}
                {selectedPersona ? (
                  <EntityCard type="persona" entity={selectedPersona} disableClick={true} />
                ) : (
                  <>
                    <i className="bi bi-person-badge" style={{ fontSize: 48, color: '#bbb', marginBottom: 12 }}></i>
                    <div style={{ fontWeight: 600, fontSize: '1.02rem', color: '#888', textAlign: 'center' }}>{t('chat_init_modal.select_persona')}</div>
                  </>
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
                    onClick={e => { e.stopPropagation(); if (setSelectedScene) setSelectedScene(null); }}
                  >
                    ×
                  </button>
                )}
                {selectedScene ? (
                  <EntityCard type="scene" entity={selectedScene} disableClick={true} />
                ) : (
                  <>
                    <i className="bi bi-easel" style={{ fontSize: 48, color: '#bbb', marginBottom: 12 }}></i>
                    <div style={{ fontWeight: 600, fontSize: '1.02rem', color: '#888', textAlign: 'center' }}>{t('chat_init_modal.select_scene')}</div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer d-flex justify-content-center" style={{ gap: 16 }}>
            <SecondaryButton
              onClick={onCancel}
              isMobile={isMobile}
              style={{ borderRadius: '1.6rem', fontWeight: 600, fontSize: '1.02rem', paddingTop: 8, paddingBottom: 8 }}
            >
              {t('chat_init_modal.cancel')}
            </SecondaryButton>
            <PrimaryButton
              onClick={onStartChat}
              isMobile={isMobile}
              style={{ borderRadius: '1.6rem', fontWeight: 700, fontSize: '1.08rem', paddingTop: 8, paddingBottom: 8 }}
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
