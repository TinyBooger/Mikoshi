import React from 'react';

import EntityCard from '../components/EntityCard';


export default function ChatInitModal({
  show,
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
  if (!show) return null;

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
            <h5 className="modal-title">Initialize Chat</h5>
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
                    title="Remove Character"
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
                    <div style={{ fontWeight: 600, fontSize: '1.02rem', color: '#888', textAlign: 'center' }}>Select Character</div>
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
                    title="Remove Persona"
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
                    <div style={{ fontWeight: 600, fontSize: '1.02rem', color: '#888', textAlign: 'center' }}>Select Persona</div>
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
                    title="Remove Scene"
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
                    <div style={{ fontWeight: 600, fontSize: '1.02rem', color: '#888', textAlign: 'center' }}>Select Scene</div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer d-flex justify-content-center" style={{ gap: 16 }}>
            <button
              className="btn btn-secondary px-4 py-2"
              style={{ borderRadius: '1.6rem', fontWeight: 600, fontSize: '1.02rem' }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary px-5 py-2"
              style={{ borderRadius: '1.6rem', fontWeight: 700, fontSize: '1.08rem' }}
              onClick={onStartChat}
              disabled={!selectedCharacter}
            >
              Start Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
