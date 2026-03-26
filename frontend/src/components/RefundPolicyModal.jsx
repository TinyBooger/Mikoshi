import React from 'react';
import { createPortal } from 'react-dom';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

export default function RefundPolicyModal({ show, onClose, policyType }) {
  if (!show) return null;

  let content = null;
  if (policyType === 'pro') {
    content = (
      <>
        <h5 className="fw-bold mb-3">Pro会员退款政策</h5>
        <ul>
          <li>购买后7天内，如不满意可全额退款。</li>
          <li>超出7天后不可退款。</li>
        </ul>
      </>
    );
  } else if (policyType === 'token') {
    content = (
      <>
        <h5 className="fw-bold mb-3">Token充值退款政策</h5>
        <ul>
          <li>仅在充值包Token未被使用时可申请退款。</li>
          <li>一旦Token有部分使用，则不可退款。</li>
        </ul>
      </>
    );
  }

  return createPortal(
    <div style={{ position: 'fixed', zIndex: 1200, top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 400, width: '90%', padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        {content}
        <div className="d-flex justify-content-end mt-4 gap-2">
          <SecondaryButton onClick={onClose}>关闭</SecondaryButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
