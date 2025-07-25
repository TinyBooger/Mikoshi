import React from 'react';
import { useNavigate } from 'react-router';

import defaultPicture from '../assets/images/default-picture.png';

export default function CharacterCard({ character }) {
  const navigate = useNavigate();
  const { id, name, picture, views, likes, tagline, creator } = character;

  // Fixed card size
  const CARD_WIDTH = 260;
  const CARD_HEIGHT = 140;
  const IMAGE_SIZE = 80;

  return (
    <div
      className="d-flex flex-row align-items-stretch position-relative"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        margin: '12px 10px',
        background: '#f4f6fb',
        borderRadius: 14,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.2s',
        overflow: 'hidden',
        border: '1.5px solid #e9ecef',
        minWidth: CARD_WIDTH,
        maxWidth: CARD_WIDTH,
      }}
      onClick={() => navigate(`/chat?character=${encodeURIComponent(id)}`)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.13)'; e.currentTarget.style.transform = 'translateY(-2px) scale(1.018)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Image section */}
      <div style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e9ecef', borderRadius: 10, margin: 14, marginRight: 0, overflow: 'hidden', flexShrink: 0 }}>
        <img
          src={picture || defaultPicture}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', borderRadius: 8 }}
        />
      </div>
      {/* Info section with fixed layout */}
      <div className="d-flex flex-column justify-content-between ps-3 pe-2 py-2 flex-grow-1" style={{ minWidth: 0, height: '100%' }}>
        {/* Name */}
        <div style={{ height: 28, display: 'flex', alignItems: 'center' }}>
          <h5 className="fw-bold text-dark text-truncate mb-0" style={{ fontSize: '1.05rem', maxWidth: 130, fontFamily: 'Inter, sans-serif', letterSpacing: '0.2px', lineHeight: 1.1 }}>{name}</h5>
        </div>
        {/* Tagline (fixed area) */}
        <div style={{ height: 32, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <span className="text-secondary px-1" style={{ fontSize: '0.97rem', maxWidth: 140, fontFamily: 'Inter, sans-serif', fontWeight: 500, letterSpacing: '0.1px', lineHeight: '1.2', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {tagline || <span style={{ opacity: 0.4 }}>No tagline</span>}
          </span>
        </div>
        {/* Creator (fixed area) */}
        <div style={{ height: 22, display: 'flex', alignItems: 'center' }}>
          <span className="text-muted small px-1" style={{ fontSize: '0.93rem', maxWidth: 120, fontFamily: 'Inter, sans-serif', fontWeight: 400, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            <i className="bi bi-person-circle me-1"></i> {creator ? (typeof creator === 'object' ? creator.name : creator) : <span style={{ opacity: 0.4 }}>Unknown</span>}
          </span>
        </div>
        {/* Stats */}
        <div className="d-flex align-items-center gap-2 mt-1" style={{ height: 22 }}>
          <span className="d-flex align-items-center px-2 py-1 rounded-pill bg-light text-secondary" style={{ fontSize: 13 }}>
            <i className="bi bi-chat me-1"></i> {views}
          </span>
          <span className="d-flex align-items-center px-2 py-1 rounded-pill bg-light text-secondary" style={{ fontSize: 13 }}>
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
