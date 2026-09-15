import React from 'react';

// 网站备案号（工信部 ICP 备案）
const ICP_NUMBER = '滇ICP备2025072925号';
const ICP_URL = 'https://beian.miit.gov.cn/';

/**
 * ICP 备案信息。
 *
 * 中国大陆的网站需要在页面上展示备案号，因此登录页（固定底部）与
 * 首页（内容末尾）都要用到同一份信息，这里统一成一个组件，避免
 * 两处硬编码各写一遍。
 *
 * variant:
 *  - 'fixed'  （默认）悬浮固定在视口底部，适合内容较短的页面（登录页）
 *  - 'inline' 跟随文档流，放在内容末尾，适合可滚动的长页面（首页）
 */
export default function IcpFiling({ variant = 'fixed', number = ICP_NUMBER }) {
  const isFixed = variant === 'fixed';

  const linkStyle = {
    fontSize: '0.8rem',
    color: '#adb5bd',
    opacity: 0.8,
    textDecoration: 'none',
    padding: '4px 10px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.6)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    pointerEvents: 'auto',
    backdropFilter: 'blur(8px)',
    whiteSpace: 'nowrap',
  };

  if (isFixed) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '12px',
          left: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <a href={ICP_URL} target="_blank" rel="noreferrer" style={linkStyle}>
          {number}
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '8px 0 16px',
      }}
    >
      <a href={ICP_URL} target="_blank" rel="noreferrer" style={linkStyle}>
        {number}
      </a>
    </div>
  );
}
