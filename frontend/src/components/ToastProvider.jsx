import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, { type = 'info', duration = 4000 } = {}) => {
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
          <div key={t.id} style={{ ...styles.toast, ...(t.type === 'error' ? styles.error : {}) }}>
            {t.message}
            <button onClick={() => hide(t.id)} style={styles.close}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: 16,
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
    boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
    border: '1px solid #e9ecef',
    color: '#232323',
    position: 'relative'
    ,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    paddingRight: 40
  },
  error: {
    background: '#fff6f6',
    borderColor: '#f5c6cb'
  },
  close: {
    position: 'absolute',
    right: 8,
    top: 6,
    border: 'none',
    background: 'transparent',
    fontSize: 16,
    cursor: 'pointer'
  }
};

export default ToastProvider;
