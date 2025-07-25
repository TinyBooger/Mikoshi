import React from 'react';
import { useNavigate } from 'react-router';

import defaultPicture from '../assets/images/default-picture.png';

export default function CharacterCard({ character }) {
  const navigate = useNavigate();
  const { id, name, picture, views, likes, tagline, creator } = character;

  return (
    <div
      className="d-flex flex-row align-items-stretch position-relative"
      style={{
        width: 390,
        height: 200,
        margin: '22px 18px',
        background: '#f4f6fb', // much lighter than homepage bg
        borderRadius: 18,
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.2s',
        overflow: 'hidden',
        border: '2.5px solid #e9ecef',
      }}
      onClick={() => navigate(`/chat?character=${encodeURIComponent(id)}`)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.13)'; e.currentTarget.style.transform = 'translateY(-2px) scale(1.025)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Image section */}
      <div style={{ width: 140, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e9ecef', borderRadius: '14px', margin: 12, marginRight: 0, overflow: 'hidden', flexShrink: 0 }}>
        <img
          src={picture || defaultPicture}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', borderRadius: '10px' }}
        />
      </div>
      {/* Info section */}
      <div className="d-flex flex-column justify-content-between ps-3 pe-2 py-2 flex-grow-1" style={{ minWidth: 0 }}>
        <div>
          <h5 className="fw-bold text-dark text-truncate mb-1" style={{ fontSize: '1.18rem', maxWidth: 200, fontFamily: 'Inter, sans-serif', letterSpacing: '0.2px' }}>{name}</h5>
          {tagline && (
            <div className="text-secondary mb-2 px-1" style={{ fontSize: '1.05rem', maxWidth: 220, fontFamily: 'Inter, sans-serif', fontWeight: 500, letterSpacing: '0.1px', minHeight: 32, lineHeight: '1.3', whiteSpace: 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tagline}
            </div>
          )}
          {creator && (
            <div className="text-muted small mb-1 px-1" style={{ fontSize: '0.97rem', maxWidth: 200, fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>
              <i className="bi bi-person-circle me-1"></i> {typeof creator === 'object' ? creator.name : creator}
            </div>
          )}
        </div>
        <div className="d-flex align-items-center gap-3 mt-2">
          <span className="d-flex align-items-center px-3 py-1 rounded-pill bg-light text-secondary" style={{ fontSize: 15 }}>
            <i className="bi bi-chat me-1"></i> {views}
          </span>
          <span className="d-flex align-items-center px-3 py-1 rounded-pill bg-light text-secondary" style={{ fontSize: 15 }}>
            <i className="bi bi-hand-thumbs-up me-1"></i> {likes}
          </span>
        </div>
      </div>
      <span className="position-absolute top-0 end-0 m-2 badge bg-primary text-white" style={{ fontSize: 11, borderRadius: 8, padding: '4px 8px', display: 'none' }}>
        {/* Reserved for future status/feature */}
      </span>
    </div>
  );
}
