import React from 'react';
import { useNavigate } from 'react-router';

import defaultPicture from '../assets/images/default-picture.png';

export default function CharacterCard({ character }) {
  const navigate = useNavigate();
  const { id, name, picture, views, likes } = character;

  return (
    <div
      className="bg-white rounded-4 shadow-sm d-flex flex-column align-items-center justify-content-between position-relative"
      style={{ width: 170, height: 240, margin: 5, cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s' }}
      onClick={() => navigate(`/chat?character=${encodeURIComponent(id)}`)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; }}
    >
      <div className="d-flex flex-column align-items-center pt-3 pb-2 w-100">
        <img
          src={picture || defaultPicture}
          alt={name}
          className="shadow-sm"
          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '50%', border: '3px solid #e9ecef', background: '#f8f9fa' }}
        />
        <h6 className="mt-3 mb-1 fw-bold text-dark text-truncate" style={{ fontSize: '1.08rem', maxWidth: 120, fontFamily: 'Inter, sans-serif', letterSpacing: '0.2px' }}>{name}</h6>
      </div>
      <div className="d-flex justify-content-center align-items-center gap-3 pb-3 w-100">
        <span className="d-flex align-items-center px-2 py-1 rounded-pill bg-light text-secondary" style={{ fontSize: 13 }}>
          <i className="bi bi-chat me-1"></i> {views}
        </span>
        <span className="d-flex align-items-center px-2 py-1 rounded-pill bg-light text-secondary" style={{ fontSize: 13 }}>
          <i className="bi bi-hand-thumbs-up me-1"></i> {likes}
        </span>
      </div>
      <span className="position-absolute top-0 end-0 m-2 badge bg-primary text-white" style={{ fontSize: 11, borderRadius: 8, padding: '4px 8px', display: 'none' }}>
        {/* Reserved for future status/feature */}
      </span>
    </div>
  );
}
