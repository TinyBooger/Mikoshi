import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import ReactDOM from 'react-dom';
import { AuthContext } from './AuthProvider';

const TYPE_META = {
  warn:   { icon: 'bi-exclamation-triangle-fill', color: '#e67e22', bg: '#fff8f0' },
  ban:    { icon: 'bi-slash-circle-fill',         color: '#dc3545', bg: '#fff5f5' },
  unban:  { icon: 'bi-check-circle-fill',         color: '#28a745', bg: '#f0fff4' },
  advice: { icon: 'bi-pencil-fill',               color: '#6A5ACD', bg: '#f5f3ff' },
  system: { icon: 'bi-bell-fill',                 color: '#6c757d', bg: '#f8f9fa' },
};
const DEFAULT_META = TYPE_META.system;

function fmt(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return ''; }
}

/** Self-contained mail icon + dropdown panel. Drop-in replacement for any button. */
export default function MessageCenter() {
  const btnRef = useRef(null);
  const { sessionToken } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null); // id of expanded message
  const panelRef = useRef(null);

  // ── fetch unread count (poll + initial) ───────────────────
  const fetchUnread = useCallback(() => {
    if (!sessionToken) return;
    fetch(`${window.API_BASE_URL}/api/me/messages/unread-count`, {
      headers: { Authorization: sessionToken },
    })
      .then(r => r.json())
      .then(d => setUnread(d.unread_count ?? 0))
      .catch(() => {});
  }, [sessionToken]);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 60_000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  // ── fetch messages when panel opens ──────────────────────
  const fetchMessages = useCallback(() => {
    if (!sessionToken) return;
    setLoading(true);
    fetch(`${window.API_BASE_URL}/api/me/messages?limit=30`, {
      headers: { Authorization: sessionToken },
    })
      .then(r => r.json())
      .then(data => { setMessages(Array.isArray(data) ? data : []); })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [sessionToken]);

  useEffect(() => {
    if (open) fetchMessages();
  }, [open, fetchMessages]);

  // ── close on outside click ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── mark single read ──────────────────────────────────────
  const markRead = useCallback((id) => {
    if (!sessionToken) return;
    fetch(`${window.API_BASE_URL}/api/me/messages/${id}/read`, {
      method: 'POST',
      headers: { Authorization: sessionToken },
    }).then(() => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
      setUnread(prev => Math.max(0, prev - 1));
    }).catch(() => {});
  }, [sessionToken]);

  // ── mark all read ─────────────────────────────────────────
  const markAllRead = useCallback(() => {
    if (!sessionToken) return;
    fetch(`${window.API_BASE_URL}/api/me/messages/read-all`, {
      method: 'POST',
      headers: { Authorization: sessionToken },
    }).then(() => {
      setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
      setUnread(0);
    }).catch(() => {});
  }, [sessionToken]);

  const toggleExpand = (msg) => {
    if (!msg.is_read) markRead(msg.id);
    setExpanded(prev => (prev === msg.id ? null : msg.id));
  };

  // ── portal position ───────────────────────────────────────
  const [panelStyle, setPanelStyle] = useState({});
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPanelStyle({
      position: 'fixed',
      top: r.bottom + 6,
      right: Math.max(8, window.innerWidth - r.right),
      zIndex: 10000,
    });
  }, [open]);

  const panel = open ? (
    <div
      ref={panelRef}
      style={{
        ...panelStyle,
        width: 340,
        maxHeight: '70vh',
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(80,60,120,0.18)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #ece8f4',
      }}
    >
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.85rem 1rem 0.7rem',
        borderBottom: '1px solid #ece8f4',
        background: '#faf9ff',
      }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#3d3557' }}>消息</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              style={{ border: 'none', background: 'none', color: '#736B92', fontSize: '0.8rem', cursor: 'pointer', padding: '2px 6px', borderRadius: 6 }}
            >
              全部已读
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            style={{ border: 'none', background: 'none', color: '#aaa', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: '2px 4px' }}
          >
            <i className="bi bi-x" />
          </button>
        </div>
      </div>

      {/* list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#aaa', fontSize: '0.9rem' }}>加载中…</div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#bbb', fontSize: '0.9rem' }}>
            <i className="bi bi-inbox" style={{ fontSize: '1.8rem', display: 'block', marginBottom: 8 }} />
            暂无消息
          </div>
        )}
        {!loading && messages.map(msg => {
          const meta = TYPE_META[msg.msg_type] || DEFAULT_META;
          const isExpanded = expanded === msg.id;
          return (
            <div
              key={msg.id}
              onClick={() => toggleExpand(msg)}
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid #f3f0fa',
                background: msg.is_read ? '#fff' : meta.bg,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f7f4ff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = msg.is_read ? '#fff' : meta.bg; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <i
                  className={`bi ${meta.icon}`}
                  style={{ color: meta.color, fontSize: '1.05rem', marginTop: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!msg.is_read && (
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: meta.color, flexShrink: 0, display: 'inline-block',
                      }} />
                    )}
                    <span style={{ fontWeight: msg.is_read ? 500 : 700, fontSize: '0.9rem', color: '#3d3557', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {msg.title}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#b0a8c8', flexShrink: 0 }}>{fmt(msg.created_at)}</span>
                  </div>
                  <div style={{
                    fontSize: '0.82rem', color: '#6b6383', marginTop: 3,
                    ...(isExpanded ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                    whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
                  }}>
                    {msg.body}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* trigger button */}
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        aria-label="消息"
        title="消息"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#736B92',
          fontSize: '1.2rem',
          padding: '0.35rem 0.55rem',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'background 0.16s, color 0.16s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,208,245,0.55)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <i className="bi bi-envelope" style={{ fontSize: '1.2rem' }} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            minWidth: 16, height: 16, background: '#dc3545', color: '#fff',
            borderRadius: 8, fontSize: '0.65rem', fontWeight: 700,
            lineHeight: '16px', padding: '0 4px', textAlign: 'center',
            pointerEvents: 'none',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {panel && ReactDOM.createPortal(panel, document.body)}
    </>
  );
}
