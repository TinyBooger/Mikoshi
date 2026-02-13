import React from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 p-4">
      <div className="text-center">
        <h1 className="display-1 fw-bold mb-2">404</h1>
        <h2 className="mb-4">Page Not Found</h2>
        <p className="text-muted mb-4">
          Sorry, the page you're looking for doesn't exist.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/')}
        >
          Go Back Home
        </button>
      </div>
    </div>
  );
}
