import React from 'react';
import { useNavigate } from 'react-router';

import defaultPicture from '../assets/images/default-picture.png';

export default function CharacterCard({ character }) {
  const navigate = useNavigate();
  const { id, name, picture, views, likes } = character;

  return (
    <div
      className="card text-center"
      style={{ width: 150, height: 220, margin: 5, cursor: 'pointer' }}
      onClick={() => navigate(`/chat?character=${encodeURIComponent(id)}`)}
    >
      <img
        src={picture || defaultPicture}
        className="card-img-top"
        alt={name}
        style={{ height: 120, objectFit: 'cover', borderRadius: 8 }}
      />
      <div className="card-body p-2">
        <h6 className="card-title mb-1 text-truncate">{name}</h6>
        <div className="d-flex justify-content-center text-muted" style={{ fontSize: 12 }}>
          <span className="me-2">
            <i className="bi bi-chat"></i> {views}
          </span>
          <span>
            <i className="bi bi-hand-thumbs-up"></i> {likes}
          </span>
        </div>
      </div>
    </div>
  );
}
