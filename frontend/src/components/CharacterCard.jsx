import React from 'react';
import { useNavigate } from 'react-router';

import defaultPicture from '../assets/images/default-picture.png';

export default function CharacterCard({ character }) {
  const navigate = useNavigate();
  const { id, name, picture, views, likes, tagline, creator } = character;

  // Enlarged card size
  const CARD_WIDTH = 370; // Increased width
  const CARD_HEIGHT = 180;
  const IMAGE_SIZE = CARD_HEIGHT - 24; // Adjusted for padding and margins

  return (
    <div
      className="d-flex flex-row align-items-stretch position-relative"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        margin: '8px 8px', // Reduced margin for closer cards, but enough for shadow
        background: '#f7f7f7',
        borderRadius: 16,
        boxShadow: '0 3px 16px rgba(0,0,0,0.10)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.2s',
        overflow: 'hidden',
        border: '2px solid #e9ecef',
        minWidth: CARD_WIDTH,
        maxWidth: CARD_WIDTH,
      }}
      onClick={() => navigate(`/chat?character=${encodeURIComponent(id)}`)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.13)'; e.currentTarget.style.transform = 'translateY(-2px) scale(1.018)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Image section */}
      <div style={{ 
        width: IMAGE_SIZE, 
        height: IMAGE_SIZE, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#e9ecef', 
        borderRadius: 12, 
        margin: 12, 
        marginRight: 0, 
        overflow: 'hidden', 
        flexShrink: 0,
        alignSelf: 'center' 
        }}>
        <img
          src={picture || defaultPicture}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', borderRadius: 8 }}
        />
      </div>
      {/* Info section with fixed layout */}
      <div className="d-flex flex-column justify-content-between ps-3 pe-2 py-2 flex-grow-1" style={{ minWidth: 0, height: '100%' }}>
        {/* Name and creator in one block */}
        <div style={{ minHeight: 50 }}>
          <h5 className="fw-bold text-dark text-truncate mb-1" style={{ 
            fontSize: '1.22rem', 
            maxWidth: 180, 
            fontFamily: 'Inter, sans-serif', 
            letterSpacing: '0.2px', 
            lineHeight: 1.1 
          }}>
            {name}
          </h5>
          <span className="text-muted small" style={{ 
            fontSize: '0.85rem', 
            fontFamily: 'Inter, sans-serif', 
            fontWeight: 400,
            display: 'block',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            maxWidth: '100%'
          }}>
            <i className="bi bi-person-circle me-1"></i> 
            {creator ? (typeof creator === 'object' ? creator.name : creator) : <span style={{ opacity: 0.4 }}>Unknown</span>}
          </span>
        </div>
        {/* Tagline (fixed area) */}
        <div style={{ flex: 1, padding: '2px 0', display: 'flex', overflow: 'hidden' }}>
          <span className="text-secondary px-1" style={{ 
            fontSize: '0.95rem', 
            maxWidth: 200, 
            fontFamily: 'Inter, sans-serif', 
            fontWeight: 500, 
            letterSpacing: '0.1px', 
            lineHeight: '1.3', 
            display: '-webkit-box', 
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical', 
            whiteSpace: 'normal', 
            textOverflow: 'ellipsis', 
            overflow: 'hidden' }}>
            {tagline || <span style={{ opacity: 0.4 }}>No tagline</span>}
          </span>
        </div>
      {/* Stats: compact, bottom right */}
      <div className="d-flex align-items-center justify-content-end gap-2" style={{ height: 24, width: '100%' }}>
        <span className="d-flex align-items-center px-2 text-secondary" style={{ fontSize: 13 }}>
          <i className="bi bi-chat me-1"></i> {views}
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
