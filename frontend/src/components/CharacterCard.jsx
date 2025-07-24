import React from 'react';
import { useNavigate } from 'react-router';

import defaultPicture from '../assets/images/default-picture.png';

export default function CharacterCard({ character }) {
  const navigate = useNavigate();
  const { id, name, picture, views, likes, tagline, creator } = character;

  return (
    <div
      className="bg-white rounded-4 shadow-sm d-flex flex-column align-items-center position-relative"
      style={{ width: 220, height: 320, margin: 8, cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s', overflow: 'hidden' }}
      onClick={() => navigate(`/chat?character=${encodeURIComponent(id)}`)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; }}
    >
      <div className="d-flex flex-column align-items-center pt-3 pb-2 w-100" style={{ flex: '1 1 auto', minHeight: 0 }}>
        <img
          src={picture || defaultPicture}
          alt={name}
          className="shadow-sm"
          style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: '18px', border: '3px solid #e9ecef', background: '#f8f9fa' }}
        />
        <h5 className="mt-3 mb-1 fw-bold text-dark text-truncate" style={{ fontSize: '1.18rem', maxWidth: 180, fontFamily: 'Inter, sans-serif', letterSpacing: '0.2px' }}>{name}</h5>
        {tagline && (
          <div className="text-secondary text-truncate mb-1 px-2" style={{ fontSize: '1rem', maxWidth: 180, fontFamily: 'Inter, sans-serif', fontWeight: 500, letterSpacing: '0.1px' }}>
            {tagline}
          </div>
        )}
        {creator && (
          <div className="text-muted small mb-1 px-2" style={{ fontSize: '0.95rem', maxWidth: 180, fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>
            <i className="bi bi-person-circle me-1"></i> {typeof creator === 'object' ? creator.name : creator}
          </div>
        )}
      </div>
      <div className="d-flex justify-content-center align-items-center gap-3 w-100" style={{ paddingBottom: 18 }}>
        <span className="d-flex align-items-center px-3 py-1 rounded-pill bg-light text-secondary" style={{ fontSize: 15 }}>
          <i className="bi bi-chat me-1"></i> {views}
        </span>
        <span className="d-flex align-items-center px-3 py-1 rounded-pill bg-light text-secondary" style={{ fontSize: 15 }}>
          <i className="bi bi-hand-thumbs-up me-1"></i> {likes}
        </span>
      </div>
      <span className="position-absolute top-0 end-0 m-2 badge bg-primary text-white" style={{ fontSize: 11, borderRadius: 8, padding: '4px 8px', display: 'none' }}>
        {/* Reserved for future status/feature */}
      </span>
    </div>
  );
}
