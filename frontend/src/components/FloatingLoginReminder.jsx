import React, { useContext, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { AuthContext } from './AuthProvider';

export default function FloatingLoginReminder() {
  const { userData, loading } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || userData || loading) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1050,
        animation: 'loginBannerSlideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: 'calc(100vw - 2rem)',
        width: '480px',
      }}
    >
      <style>{`
        @keyframes loginBannerSlideDown {
          0% { transform: translate(-50%, -100%); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.95) 0%, rgba(45, 40, 60, 0.95) 100%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.08) inset',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>👋</span>
          <span style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '0.88rem',
            fontWeight: 500,
            lineHeight: 1.3,
          }}>
            登录后即可与角色聊天、创建内容，加入社区！
          </span>
        </div>
        <button
          onClick={() => navigate('/login', { state: { from: location.pathname + location.search } })}
          style={{
            flexShrink: 0,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '0.5rem 1.1rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'transform 0.15s, box-shadow 0.15s',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(102, 126, 234, 0.5)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
          }}
        >
          登录
        </button>
      </div>
    </div>,
    document.body
  );
}
