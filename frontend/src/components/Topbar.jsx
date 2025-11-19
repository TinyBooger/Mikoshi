import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router';
import { AuthContext } from './AuthProvider';
import logoText from '../assets/images/logo_text.png';
import ProblemReportModal from './ProblemReportModal';


function Topbar({ onToggleSidebar, sidebarVisible, onToggleCharacterSidebar, characterSidebarVisible }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionToken } = useContext(AuthContext);

  // Only use search bar if not on ChatPage
  const isChatPage = location.pathname.startsWith('/chat');

  // Search bar state and logic only if not ChatPage
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sessionToken) return;
      if (query.trim() === '') {
        fetch(`${window.API_BASE_URL}/api/search-suggestions/popular`, {
          headers: { 'Authorization': sessionToken }
        })
          .then(res => res.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      } else {
        fetch(`${window.API_BASE_URL}/api/search-suggestions?q=${encodeURIComponent(query.trim())}`, {
          headers: { 'Authorization': sessionToken }
        })
          .then(res => res.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, sessionToken]);

  const handleSearch = (q = query) => {
    const trimmed = q.trim();
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const [lang, setLang] = useState(i18n.language === 'zh' ? 'zh' : 'en');
  const handleLangToggle = () => {
    const newLang = lang === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
    setLang(newLang);
  };

  const [showProblemReport, setShowProblemReport] = useState(false);

  return (
    <div
      className="d-flex align-items-center justify-content-start px-3 py-1 shadow-sm"
      style={{
        height: '7dvh',
        zIndex: 100,
        background: 'rgba(255,255,255,0.48)', // half transparent white
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        borderBottom: '1.2px solid #e9ecef',
        fontFamily: 'Inter, sans-serif',
        position: 'sticky',
        top: 0,
      }}>
      {/* Sidebar Toggle Button - modern, clean, icon only */}
      <button
        className="me-2"
        style={{
          border: 'none',
          background: 'none',
          padding: 0,
          margin: 0,
          color: '#232323',
          fontSize: '1.6rem',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s',
        }}
        onClick={onToggleSidebar}
        aria-label={sidebarVisible ? t('topbar.hide_sidebar') : t('topbar.show_sidebar')}
        tabIndex={0}
        onMouseEnter={e => { e.currentTarget.style.color = '#232323'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#232323'; }}
      >
        <i
          className={`bi ${sidebarVisible ? 'bi-layout-sidebar' : 'bi-layout-sidebar'}`}
          style={{ fontSize: '1.6rem', pointerEvents: 'none' }}
        ></i>
      </button>

      {/* Logo (click to go home) */}
      <img
        src={logoText}
        alt="Mikoshi"
        draggable={false}
        className="ms-2 d-none d-sm-block"
        style={{ height: 34, objectFit: 'contain', cursor: 'pointer' }}
        onClick={() => navigate('/')}
      />

      {/* Search Bar - always visible */}
      <div className="ms-3 ms-md-4" style={{ width: 'clamp(280px, 40vw, 680px)', position: 'relative' }}>
        <div
          className="input-group input-group-lg rounded-pill shadow-sm"
          style={{
            background: '#f5f6fa',
            borderRadius: 28,
            border: `2px solid ${searchFocused ? '#736B92' : 'transparent'}`,
            boxShadow: searchFocused ? '0 0 0 4px rgba(115,107,146,0.18)' : 'none',
            transition: 'box-shadow 120ms ease, border-color 120ms ease'
          }}
        >
          <input
            type="text"
            className="form-control border-0 rounded-pill"
            style={{ background: 'transparent', fontSize: '1rem', paddingLeft: 16, color: '#232323', outline: 'none', boxShadow: 'none' }}
            placeholder={t('topbar.search_placeholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            onFocus={() => { setShowSuggestions(true); setSearchFocused(true); }}
            onBlur={() => setTimeout(() => { setShowSuggestions(false); setSearchFocused(false); }, 100)}
            aria-autocomplete="list"
            aria-haspopup="true"
          />
          <button
            className="btn rounded-pill px-3"
            style={{ fontSize: '1rem', background: '#736B92', color: '#fff', borderColor: '#736B92', outline: 'none', boxShadow: 'none' }}
            onClick={() => handleSearch()}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 100)}
          >
            <i className="bi bi-search" style={{ fontSize: '1rem' }}></i>
          </button>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <ul
            className="list-group position-absolute w-100 shadow rounded-4"
            style={{ top: '100%', zIndex: 1040, maxHeight: 176, overflowY: 'auto', background: '#fff', color: '#232323', border: 'none', fontSize: '0.8rem' }}>
            {suggestions.map(({ keyword, count }) => (
              <li
                key={keyword}
                className="list-group-item list-group-item-action rounded-3"
                style={{ cursor: 'pointer', transition: 'background 0.16s', background: 'transparent', color: '#232323', border: 'none', fontSize: '0.8rem' }}
                onClick={() => handleSearch(keyword)}
                onMouseEnter={e => { e.currentTarget.style.background = '#232323'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}>
                <span className="fw-semibold">{keyword}</span> <small className="text-muted">{t('topbar.suggestion_count', { count })}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Right side controls (language switch and character sidebar toggle) */}
      <div className="ms-auto d-flex align-items-center" style={{ gap: '0.75rem' }}>
        <button
          onClick={handleLangToggle}
          aria-label={lang === 'zh' ? '切换到英文' : 'Switch to Chinese'}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#736B92',
            fontWeight: 700,
            fontSize: '0.86rem',
            letterSpacing: '0.06em',
            padding: '0.42rem 0.7rem',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'background 0.16s, color 0.16s',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,208,245,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ opacity: lang === 'zh' ? 1 : 0.5, fontWeight: lang === 'zh' ? 800 : 500 }}>中</span>
          <span style={{ margin: '0 2px', opacity: 0.35 }}>|</span>
          <span style={{ opacity: lang === 'en' ? 1 : 0.5, fontWeight: lang === 'en' ? 800 : 500 }}>En</span>
        </button>

        {/* Problem Report Button */}
        <button
          onClick={() => setShowProblemReport(true)}
          aria-label={t('topbar.report_problem')}
          title={t('topbar.report_problem')}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#736B92',
            fontSize: '1.3rem',
            padding: '0.42rem 0.7rem',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'background 0.16s, color 0.16s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,208,245,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <i className="bi bi-flag" style={{ fontSize: '1.3rem' }}></i>
        </button>
        
        {/* Character Sidebar Toggle Button for ChatPage only - positioned on far right */}
        {isChatPage && (
          <button
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              margin: 0,
              color: '#232323',
              fontSize: '1.4rem',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s',
            }}
            onClick={onToggleCharacterSidebar}
            aria-label={characterSidebarVisible ? t('topbar.hide_character_sidebar') : t('topbar.show_character_sidebar')}
            tabIndex={0}
            onMouseEnter={e => { e.currentTarget.style.color = '#232323'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#232323'; }}
          >
            <i
              className={`bi ${characterSidebarVisible ? 'bi-people-fill' : 'bi-people'}`}
              style={{ fontSize: '1.4rem', pointerEvents: 'none' }}
            ></i>
          </button>
        )}
      </div>
      
      {/* Problem Report Modal */}
      <ProblemReportModal show={showProblemReport} onClose={() => setShowProblemReport(false)} />
    </div>
  );
}

export default Topbar;