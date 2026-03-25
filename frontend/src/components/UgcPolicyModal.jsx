import React from 'react';
import { createPortal } from 'react-dom';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

export default function UgcPolicyModal({ show, onClose, onAgree }) {
  if (!show) return null;

  return createPortal(
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="版权与用户生成内容政策">
      <div style={styles.modal}>
        <div style={styles.header}>
          <strong>版权与用户生成内容（UGC）发布须知</strong>
        </div>

        <div style={styles.body}>
          <div style={styles.scrollArea}>
            <p style={styles.paragraph}>在创建并发布角色、场景、人设前，请了解以下规则：</p>
            <ul style={styles.list}>
              <li>你对上传的文本、图片等内容拥有合法权利，或已获得充分授权。</li>
              <li>不得上传、改编或分发未经授权的受版权保护内容。</li>
              <li>不得冒用他人身份、品牌或作品，避免误导或侵权。</li>
              <li>如使用第三方素材，你需要自行承担授权与来源合规责任。</li>
              <li>平台有权对涉嫌侵权或违规内容进行下架、限制展示或删除。</li>
              <li>若引发纠纷，你需要配合处理并承担相应法律责任。</li>
            </ul>
            <p style={styles.paragraph}>
              点击“同意并继续”即表示你已阅读并同意遵守上述规则。
            </p>
          </div>
        </div>

        <div style={styles.footer}>
          <SecondaryButton onClick={onClose}>取消</SecondaryButton>
          <PrimaryButton onClick={onAgree}>同意并继续</PrimaryButton>
        </div>
      </div>
    </div>,
    document.body
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.45)',
    zIndex: 2100,
    padding: '1rem',
  },
  modal: {
    width: '100%',
    maxWidth: 640,
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  header: {
    padding: '1rem 1.1rem',
    borderBottom: '1px solid #eee',
    fontSize: '1.05rem',
    color: '#1f2937',
  },
  body: {
    padding: '1rem 1.1rem 0.8rem',
    color: '#374151',
    fontSize: '0.94rem',
    lineHeight: 1.65,
  },
  scrollArea: {
    maxHeight: '48vh',
    overflowY: 'auto',
    paddingRight: 4,
  },
  paragraph: {
    marginBottom: '0.65rem',
  },
  list: {
    margin: '0.2rem 0 0.75rem 1.2rem',
    padding: 0,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    padding: '0.75rem 1rem 1rem',
    borderTop: '1px solid #eee',
    background: '#f9fafb',
  },
};
