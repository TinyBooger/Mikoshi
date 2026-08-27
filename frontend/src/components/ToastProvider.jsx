import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, { type = 'info', duration = 15000 } = {}) => {
    const id = ++idCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const hide = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      <div style={styles.container} aria-live="polite" aria-atomic="true">
        {toasts.map(t => (
          <div key={t.id} style={{ ...styles.toast, ...(typeStyles[t.type] || {}) }}>
            <span style={{ ...styles.icon, ...(iconStyles[t.type] || iconStyles.info) }}>
              {icons[t.type] || icons.info}
            </span>
            <span style={styles.message}>{t.message}</span>
            <button onClick={() => hide(t.id)} style={styles.close} aria-label="关闭">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const icons = {
  success: '✓',
  error: '×',
  info: 'ⓘ'
};

const iconStyles = {
  success: { color: '#16a34a', background: '#dcfce7' },
  error: { color: '#dc2626', background: '#fee2e2' },
  info: { color: '#2563eb', background: '#dbeafe' }
};

const typeStyles = {
  success: { borderColor: '#bbf7d0' },
  error: { background: '#fff6f6', borderColor: '#f5c6cb' },
  info: { borderColor: '#bfdbfe' }
};

const styles = {
  container: {
    position: 'fixed',
    top: 72,
    right: 16,
    zIndex: 3000,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 520,
    width: 'auto',
    minWidth: 280
  },
  toast: {
    background: '#fff',
    padding: '0.7rem 1.2rem',
    borderRadius: 10,
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.22), 0 4px 10px rgba(15, 23, 42, 0.12)',
    border: '1px solid #e9ecef',
    color: '#232323',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    paddingRight: 40
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1
  },
  message: {
    flex: 1,
    minWidth: 0
  },
  close: {
    position: 'absolute',
    right: 8,
    top: 8,
    border: '1px solid #dcdfe3',
    background: '#ffffff',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    padding: '2px 8px',
    lineHeight: 1.2,
    cursor: 'pointer'
  }
};

export default ToastProvider;
