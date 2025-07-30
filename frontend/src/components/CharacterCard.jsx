import React from 'react';
import { useNavigate } from 'react-router';

import defaultPicture from '../assets/images/default-picture.png';

export default function CharacterCard({ character }) {
  const navigate = useNavigate();
  const { id, name, picture, views, likes, tagline, creator } = character;

  // Compact vertical card
  const CARD_WIDTH = 150;
  const CARD_HEIGHT = 210;
  const IMAGE_SIZE = 110;

  return (
    <div
      className="d-flex flex-column align-items-center position-relative"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        cursor: 'pointer',
        border: '1.5px solid #e9ecef',
        padding: 0,
        margin: 0,
        transition: 'box-shadow 0.18s, transform 0.18s',
        overflow: 'hidden',
      }}
      onClick={() => navigate(`/chat?character=${encodeURIComponent(id)}`)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.13)'; e.currentTarget.style.transform = 'translateY(-2px) scale(1.025)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Image */}
      <div style={{
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        marginTop: 14,
        marginBottom: 8,
        borderRadius: 10,
        background: '#f5f6fa',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img
          src={picture || defaultPicture}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }}
        />
      </div>
      {/* Name */}
      <div className="fw-bold text-dark text-center" style={{
        fontSize: '1.05rem',
        maxWidth: '90%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginBottom: 2,
      }}>
        {name}
      </div>
      {/* Tagline */}
      <div className="text-secondary text-center" style={{
        fontSize: '0.92rem',
        minHeight: 32,
        maxHeight: 36,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'normal',
        padding: '0 8px',
        marginBottom: 2,
        lineHeight: 1.2,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {tagline || <span style={{ opacity: 0.4 }}>No tagline</span>}
      </div>
      {/* Creator */}
      <div className="text-muted text-center" style={{
        fontSize: '0.82rem',
        marginBottom: 2,
        maxWidth: '90%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        <i className="bi bi-person-circle me-1"></i>
        {creator ? (typeof creator === 'object' ? creator.name : creator) : <span style={{ opacity: 0.4 }}>Unknown</span>}
      </div>
      {/* Stats */}
      <div className="d-flex align-items-center justify-content-center gap-2 mt-1" style={{ fontSize: 12 }}>
        <span className="d-flex align-items-center text-secondary">
          <i className="bi bi-chat me-1"></i> {views}
        </span>
        <span className="d-flex align-items-center text-secondary">
          <i className="bi bi-hand-thumbs-up me-1"></i> {likes}
        </span>
      </div>
    </div>
  );
}
        </span>
        <span className="d-flex align-items-center px-2 text-secondary" style={{ fontSize: 13 }}>
          <i className="bi bi-hand-thumbs-up me-1"></i> {likes}
        </span>
      </div>
      </div>
      <span className="position-absolute top-0 end-0 m-2 badge bg-primary text-white" style={{ fontSize: 10, borderRadius: 8, padding: '3px 7px', display: 'none' }}>
        {/* Reserved for future status/feature */}
      </span>
    </div>
  );
}
