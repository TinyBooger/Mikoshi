import React from 'react';
import { useNavigate } from 'react-router';

import defaultPicture from '../assets/images/default-picture.png';

export default function CharacterCard({ character }) {
  const navigate = useNavigate();
  const { id, name, picture, views, likes, tagline, creator } = character;

  // Enlarged card size
  const CARD_WIDTH = 296; // 370 * 0.8
  const CARD_HEIGHT = 144; // 180 * 0.8
  const IMAGE_SIZE = CARD_HEIGHT - 19; // 144 - 19

  return (
    <div
      className="d-flex flex-row align-items-stretch position-relative"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        margin: '6px 6px', // 8px * 0.8
        background: '#f7f7f7',
        borderRadius: 13,
        boxShadow: '0 2px 13px rgba(0,0,0,0.10)',
        cursor: 'pointer',
        transition: 'box-shadow 0.16s, transform 0.16s',
        overflow: 'hidden',
        border: '1.6px solid #e9ecef',
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
        borderRadius: 10, // 12 * 0.8
        margin: 10, // 12 * 0.8
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
      <div className="d-flex flex-column justify-content-between ps-2 pe-1 py-1 flex-grow-1" style={{ minWidth: 0, height: '100%' }}>
        {/* Name and creator in one block */}
        <div style={{ minHeight: 50 }}>
          <h5 className="fw-bold text-dark text-truncate mb-1" style={{ 
            fontSize: '0.98rem', // 1.22 * 0.8
            maxWidth: 144, // 180 * 0.8
            fontFamily: 'Inter, sans-serif', 
            letterSpacing: '0.16px', 
            lineHeight: 1.1 
          }}>
            {name}
          </h5>
          <span className="text-muted small" style={{ 
            fontSize: '0.68rem', // 0.85 * 0.8
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
            fontSize: '0.76rem', // 0.95 * 0.8
            maxWidth: 160, // 200 * 0.8
            fontFamily: 'Inter, sans-serif', 
            fontWeight: 500, 
            letterSpacing: '0.08px', 
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
      <div className="d-flex align-items-center justify-content-end gap-2" style={{ height: 19, width: '100%' }}>
        <span className="d-flex align-items-center px-1 text-secondary" style={{ fontSize: 10 }}>
          <i className="bi bi-chat me-1"></i> {views}
        </span>
        <span className="d-flex align-items-center px-1 text-secondary" style={{ fontSize: 10 }}>
          <i className="bi bi-hand-thumbs-up me-1"></i> {likes}
        </span>
      </div>
      </div>
      <span className="position-absolute top-0 end-0 m-1 badge bg-primary text-white" style={{ fontSize: 8, borderRadius: 6, padding: '2px 5px', display: 'none' }}>
        {/* Reserved for future status/feature */}
      </span>
    </div>
  );
}
