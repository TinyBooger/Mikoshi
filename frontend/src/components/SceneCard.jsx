
import React from 'react';
import defaultPicture from '../assets/images/default-picture.png';

export default function SceneCard({ scene }) {
  const {
    id,
    name,
    description,
    intro,
    tags,
    creator_id,
    creator_name,
    created_time,
    likes,
    views,
    picture,
  } = scene;

  // Unified vertical card size
  const CARD_WIDTH = 180;
  const CARD_HEIGHT = 250;
  const IMAGE_SIZE = CARD_WIDTH;

  return (
    <div
      className="d-flex flex-column position-relative"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        background: '#f9fafb',
        borderRadius: 16,
        boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
        border: '2px solid #e9ecef',
        overflow: 'hidden',
        transition: 'box-shadow 0.16s, transform 0.16s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.13)'; e.currentTarget.style.transform = 'translateY(-2px) scale(1.018)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Top: Image */}
      <div style={{
        width: '100%',
        height: IMAGE_SIZE,
        background: '#e9ecef',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid #e3e6ea',
        overflow: 'hidden',
        padding: 0,
      }}>
        <img
          src={picture || defaultPicture}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 0, border: 'none' }}
        />
      </div>
      {/* Name & Creator */}
      <div className="px-2 pt-2 pb-1" style={{ minWidth: 0 }}>
        <h5 className="fw-bold text-dark text-truncate mb-0" style={{ fontSize: '0.92rem', maxWidth: 150, fontFamily: 'Inter, sans-serif' }}>{name}</h5>
        <span className="text-muted small" style={{ fontSize: '0.68rem', fontFamily: 'Inter, sans-serif', fontWeight: 400, display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 150 }}>
          <i className="bi bi-person-circle me-1"></i>
          {creator_name ? creator_name : <span style={{ opacity: 0.4 }}>Unknown</span>}
        </span>
      </div>
      {/* Description/Intro */}
      <div className="px-2" style={{ flex: 1, minHeight: 22, maxHeight: 40, overflow: 'hidden', marginBottom: 2, marginTop: 2 }}>
        <span className="text-secondary" style={{ fontSize: '0.74rem', fontFamily: 'Inter, sans-serif', lineHeight: 1.18, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'normal', textOverflow: 'ellipsis', overflow: 'hidden' }}>
          {description || intro || <span style={{ opacity: 0.4 }}>No description</span>}
        </span>
      </div>
      {/* Stats */}
      <div className="d-flex align-items-center justify-content-between px-2 pb-1" style={{ minHeight: 18 }}>
        <span className="d-flex align-items-center text-secondary" style={{ fontSize: 10 }}>
          <i className="bi bi-eye me-1"></i> {typeof views === 'number' ? views.toLocaleString() : 0} views
        </span>
        <span className="d-flex align-items-center text-secondary" style={{ fontSize: 10 }}>
          <i className="bi bi-hand-thumbs-up me-1"></i> {typeof likes === 'number' ? likes.toLocaleString() : 0} likes
        </span>
      </div>
    </div>
  );
}
