
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router';
import PrimaryButton from './PrimaryButton';

export default function UpdateNotificationModal({ show, onClose }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(show);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setVisible(show);
    if (show) {
      fetchActiveNotification();
    }
  }, [show]);

  // Check if onboarding tour is active
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  
  useEffect(() => {
    // Check for onboarding tour in DOM
    const checkOnboarding = () => {
      const onboardingTourExists = document.querySelector('[style*="z-index: 9999"]') || 
                                   document.querySelector('[style*="zIndex: 9999"]');
      setIsOnboardingActive(!!onboardingTourExists);
    };
    
    // Check immediately and set up observer
    checkOnboarding();
    const interval = setInterval(checkOnboarding, 500);
    
    return () => clearInterval(interval);
  }, [visible]);

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

  // CTA convention: admins embed [label](/path) in the message text (no DB field needed).
  // e.g. "邀请好友得 100 点数！[去复制邀请码](/profile?tab=invite)"
  // eslint-disable-next-line no-useless-escape
  const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;
  const parsedLink = (() => {
    if (!notification?.message) return null;
    const m = notification.message.match(LINK_RE);
    if (!m) return null;
    return {
      label: m[1],
      target: m[2],
      cleanedMessage: notification.message.replace(m[0], '').trim(),
    };
  })();

  const handleNavigate = () => {
    if (!parsedLink) return;
    const target = parsedLink.target;
    setVisible(false);
    onClose();
    if (/^https?:\/\//i.test(target)) {
      window.open(target, '_blank', 'noopener,noreferrer');
    } else {
      navigate(target);
    }
  };

  if (!visible || loading) return null;
  
  // If no active notification, don't show anything
  if (!notification) return null;
  
  // Don't show notification if onboarding is active
  if (isOnboardingActive) return null;

  // Detect if mobile
  const isMobile = window.innerWidth <= 768;

  const modalContent = (
    <div 
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-start justify-content-end"
      style={{ 
        zIndex: 1300, 
        pointerEvents: 'none',
        padding: isMobile ? '0.5rem' : '1rem'
      }}
    >
      <div 
        className="card shadow-lg"
        style={{
          width: isMobile ? '280px' : '360px',
          maxWidth: isMobile ? '85vw' : '90vw',
          maxHeight: isMobile ? '70vh' : '85vh',
          overflowY: 'auto',
          marginTop: isMobile ? '60px' : '80px',
          pointerEvents: 'all',
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(115,107,146,0.2)',
          borderRadius: isMobile ? '12px' : '16px',
          animation: 'slideInRight 0.3s ease-out',
        }}
      >
        <div className="card-body" style={{ padding: isMobile ? '0.75rem' : '1.5rem' }}>
          <div className="d-flex justify-content-between align-items-start" style={{ marginBottom: isMobile ? '0.5rem' : '0.75rem' }}>
            <div className="d-flex align-items-center gap-2">
              <div 
                style={{
                  width: isMobile ? '24px' : '32px',
                  height: isMobile ? '24px' : '32px',
                  borderRadius: isMobile ? '6px' : '8px',
                  background: 'linear-gradient(135deg, #736B92 0%, #9B8FC6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: isMobile ? '0.85rem' : '1.1rem'
                }}
              >
                <i className="bi bi-megaphone-fill"></i>
              </div>
              <h5 className="mb-0 fw-bold" style={{ color: '#232323', fontSize: isMobile ? '0.9rem' : '1.25rem' }}>
                {notification.title}
              </h5>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={handleClose}
              aria-label="Close"
              style={{ fontSize: isMobile ? '0.65rem' : '0.8rem' }}
            ></button>
          </div>
          <div style={{ color: '#555', fontSize: isMobile ? '0.8rem' : '0.95rem', lineHeight: '1.6' }}>
            <p style={{ marginBottom: isMobile ? '0.5rem' : '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {parsedLink ? parsedLink.cleanedMessage : notification.message}
            </p>
            {notification.features && notification.features.length > 0 && (
              <div style={{ marginBottom: isMobile ? '0.5rem' : '0.75rem' }}>
                <strong style={{ fontSize: isMobile ? '0.75rem' : '0.9rem' }}>
                  活动详情：
                </strong>
                <ul className="mt-2 mb-0" style={{ paddingLeft: isMobile ? '1rem' : '1.2rem', fontSize: isMobile ? '0.75rem' : '0.9rem' }}>
                  {notification.features.map((feature, idx) => (
                    <li key={idx} style={{ marginBottom: isMobile ? '0.25rem' : '0.25rem' }}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div style={{ marginTop: isMobile ? '0.75rem' : '1rem' }}>
            {parsedLink && (
              <button
                onClick={handleNavigate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  width: '100%',
                  marginBottom: '0.5rem',
                  padding: isMobile ? '0.4rem' : '0.6rem',
                  border: '1px solid #c4b8e8',
                  borderRadius: isMobile ? 6 : 8,
                  background: '#f5f3ff',
                  color: '#5b4fa8',
                  fontSize: isMobile ? '0.8rem' : '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <i className="bi bi-box-arrow-up-right" style={{ fontSize: isMobile ? '0.7rem' : '0.85rem' }}></i>
                {parsedLink.label}
              </button>
            )}
            <PrimaryButton
              className="w-100"
              onClick={handleClose}
              style={{ borderRadius: isMobile ? 6 : 8, padding: isMobile ? '0.4rem' : '0.6rem', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.95rem' }}
            >
              知道了！
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
