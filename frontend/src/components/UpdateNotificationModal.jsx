
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import PrimaryButton from './PrimaryButton';

export default function UpdateNotificationModal({ show, onClose }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(show);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setVisible(show);
    if (show) {
      fetchActiveNotification();
    }
  }, [show]);

  const fetchActiveNotification = async () => {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/notification/active`);
      const data = await response.json();
      setNotification(data);
    } catch (error) {
      console.error('Error fetching notification:', error);
      setNotification(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
    onClose();
  };

  if (!visible || loading) return null;
  
  // If no active notification, don't show anything
  if (!notification) return null;

  const modalContent = (
    <div 
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-start justify-content-end p-3"
      style={{ 
        zIndex: 1300, 
        pointerEvents: 'none'
      }}
    >
      <div 
        className="card shadow-lg"
        style={{
          width: '360px',
          maxWidth: '90vw',
          marginTop: '80px',
          pointerEvents: 'all',
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(115,107,146,0.2)',
          borderRadius: '16px',
          animation: 'slideInRight 0.3s ease-out',
        }}
      >
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div className="d-flex align-items-center gap-2">
              <div 
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #736B92 0%, #9B8FC6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '1.1rem'
                }}
              >
                <i className="bi bi-megaphone-fill"></i>
              </div>
              <h5 className="mb-0 fw-bold" style={{ color: '#232323' }}>
                {notification.title}
              </h5>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={handleClose}
              aria-label="Close"
              style={{ fontSize: '0.8rem' }}
            ></button>
          </div>
          <div style={{ color: '#555', fontSize: '0.95rem', lineHeight: '1.6' }}>
            <p className="mb-3">
              {notification.message}
            </p>
            {notification.features && notification.features.length > 0 && (
              <div className="mb-3">
                <strong style={{ fontSize: '0.9rem' }}>
                  {t('update_notification.features_title')}
                </strong>
                <ul className="mt-2 mb-0" style={{ paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
                  {notification.features.map((feature, idx) => (
                    <li key={idx} className="mb-1">{feature}</li>
                  ))}
                </ul>
              </div>
            )}
            <div 
              className="p-3 rounded-3"
              style={{ 
                background: 'rgba(115,107,146,0.08)', 
                borderLeft: '3px solid #736B92' 
              }}
            >
              <div className="d-flex align-items-start gap-2">
                <i className="bi bi-info-circle-fill" style={{ color: '#736B92', fontSize: '1.1rem', marginTop: '2px' }}></i>
                <div style={{ fontSize: '0.85rem' }}>
                  {t('update_notification.feedback_message')}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <PrimaryButton
              className="w-100"
              onClick={handleClose}
              style={{ borderRadius: 8, padding: '0.6rem', fontWeight: 600, fontSize: '0.95rem' }}
            >
              {t('update_notification.got_it')}
            </PrimaryButton>
          </div>
        </div>
      </div>
      <style>
        {`
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(100px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
