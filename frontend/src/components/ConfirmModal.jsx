import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ConfirmModal({ show, title = 'Confirm', message = '', onConfirm, onCancel, confirmText, cancelText }) {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <div style={styles.header}>
          <strong>{title}</strong>
        </div>
        <div style={styles.body}>{message}</div>
        <div style={styles.footer}>
          <button style={{ ...styles.button, ...styles.cancel }} onClick={onCancel}>{cancelText || t('common.cancel')}</button>
          <button style={{ ...styles.button, ...styles.confirm }} onClick={onConfirm}>{confirmText || t('common.confirm')}</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.4)',
    zIndex: 2000,
    padding: '1rem'
  },
  modal: {
    width: '100%',
    maxWidth: 520,
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    overflow: 'hidden'
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #eee'
  },
  body: {
    padding: '1rem',
    fontSize: '0.95rem',
    color: '#333'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    padding: '0.75rem',
    borderTop: '1px solid #eee',
    background: '#f8f9fa'
  },
  button: {
    padding: '0.56rem 0.9rem',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600
  },
  cancel: {
    background: '#fff',
    border: '1px solid #e9ecef',
    color: '#333'
  },
  confirm: {
    background: '#18191a',
    color: '#fff'
  }
};
