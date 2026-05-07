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

  const cardWrapperStyle = {
    width: isMobile ? 'min(100%, 18rem)' : 'auto',
    maxWidth: '100%',
    position: 'relative',
    flexShrink: 0,
  };

  const placeholderCardStyle = {
    width: isMobile ? '100%' : '11.25rem',
    height: isMobile ? 'calc(100vw / 2 * 1.25 - 0.5rem)' : '15.625rem',
    borderRadius: '20px',
    background: '#f5f6fa',
    border: '2px dashed #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.18s ease, background-color 0.18s ease',
    color: '#6b7280',
    gap: 8,
    padding: '0.9rem',
    textAlign: 'center',
  };

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
        padding: isMobile ? '0.75rem' : '0 2.5rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="modal-dialog modal-lg"
        style={{
          width: '100%',
          maxWidth: isMobile ? 'min(95vw, 30rem)' : 'min(44rem, calc(100vw - 7rem))',
          margin: 'auto',
          maxHeight: '90vh',
          display: 'flex'
        }}
      >
        <div className="modal-content" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', width: '100%', borderRadius: 14, border: '1px solid #ece9f4', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.1)' }}>
          <div className="modal-header" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h5 className="modal-title" style={{ fontWeight: 800, marginBottom: 2 }}>
                进入场景
              </h5>
              <div
                style={{
                  color: '#6b7280',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: isMobile ? 'calc(95vw - 90px)' : '420px',
                }}
                title={selectedScene?.name || t('scene_select_modal.title_fallback')}
              >
                {selectedScene?.name || t('scene_select_modal.title_fallback')}
              </div>
            </div>
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
            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: isMobile ? 14 : 16,
                minHeight: isMobile ? 'auto' : 280,
              }}
            >
              <div style={cardWrapperStyle}>
                <EntityCard
                  type="scene"
                  entity={selectedScene || {
                    id: 'scene-placeholder',
                    name: t('scene_select_modal.scene'),
                    intro: t('scene_select_modal.title_fallback'),
                    picture: defaultPic,
                  }}
                  disableClick={true}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'row' : 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  color: '#6b7280',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: isMobile ? '1.05rem' : '1.1rem' }}>场景</span>
                <div
                  style={{
                    width: isMobile ? 36 : 44,
                    height: isMobile ? 36 : 44,
                    borderRadius: '50%',
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4b5563',
                  }}
                >
                  <i className={`bi ${isMobile ? 'bi-arrow-down' : 'bi-arrow-right'} fs-5`}></i>
                </div>
                <span style={{ fontSize: isMobile ? '1.05rem' : '1.1rem' }}>角色</span>
              </div>

              <div
                style={cardWrapperStyle}
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
                  <EntityCard
                    type="character"
                    entity={selectedCharacter}
                    disableClick={true}
                  />
                ) : (
                  <div
                    style={placeholderCardStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.background = '#f5f6fa';
                    }}
                  >
                    <i className="bi bi-person-plus" style={{ fontSize: isMobile ? 30 : 38, color: '#9ca3af' }}></i>
                    <div style={{ fontWeight: 700, fontSize: isMobile ? '0.9rem' : '0.95rem', color: '#4b5563' }}>
                      {t('scene_select_modal.select_character')}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                      {t('scene_select_modal.prompt')}
                    </div>
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
