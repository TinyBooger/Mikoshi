import React from 'react';

/**
 * Renders a contextual ban notice banner for banned users.
 *
 * Props:
 *  - banType: 'upload_ban' | 'full_ban'  (shadow_ban is never exposed)
 *  - banUntil: ISO date string or null
 *  - context: 'upload' | 'chat'  (controls the message copy)
 */
export default function BanNotice({ banType, banUntil, context = 'upload' }) {
  if (!banType) return null;
  if (context === 'chat' && banType !== 'full_ban') return null;
  if (context === 'upload' && banType !== 'upload_ban' && banType !== 'full_ban') return null;

  const formatUntil = (iso) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const untilStr = formatUntil(banUntil);
  const isPermanent = !banUntil;

  let headline = '';
  let detail = '';

  if (context === 'chat') {
    headline = '您的账号已被封禁。';
    detail = isPermanent
      ? '您无法发送消息，该限制为永久封禁。'
      : `您无法发送消息，封禁将于 ${untilStr} 解除。`;
  } else {
    headline = '您的内容发布权限已被限制。';
    detail = isPermanent
      ? '您无法创建或编辑内容，该限制为永久封禁。'
      : `您无法创建或编辑内容，限制将于 ${untilStr} 解除。`;
  }

  return (
    <div
      className="alert alert-danger d-flex align-items-start gap-2 mb-3"
      role="alert"
      style={{ borderLeft: '4px solid #dc3545' }}
    >
      <i className="bi bi-slash-circle-fill fs-5 mt-1 flex-shrink-0" />
      <div>
        <div className="fw-semibold">{headline}</div>
        <div className="small">{detail}</div>
        <div className="small mt-1 text-muted">
          如果您认为此处理有误，请联系客服申诉。
        </div>
      </div>
    </div>
  );
}
