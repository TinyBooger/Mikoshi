import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import EntityCard from '../components/EntityCard';
import CardSection from '../components/CardSection';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';

function BrowsePage() {
  const { t } = useTranslation();
  const { idToken } = useContext(AuthContext);
  const [characters, setCharacters] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);
  const [isLoadingAllTags, setIsLoadingAllTags] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { category } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('');

  // Set active tab based on current route
  useEffect(() => {
    if (category === 'recommended') {
      setActiveTab('recommended');
    } else if (category === 'popular') {
      setActiveTab('popular');
    } else if (category === 'recent') {
      setActiveTab('recent');
    } else {
      setActiveTab('');
    }
  }, [category]);

  const navigateToTab = (tab) => {
    navigate(`/browse/${tab}`);
  };

  useEffect(() => {
    if (!idToken) {
      navigate('/');
      return;
    }

    setIsLoading(true);
    fetch(`${window.API_BASE_URL}/api/characters/${category}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    })
      .then(res => res.json())
      .then(data => {
        setCharacters(data);
        setIsLoading(false);
      });
  }, [category, navigate, idToken]);

  return (
    <PageWrapper>
      {/* Tabs UI moved from Topbar */}
      <div className="d-flex mx-2 mb-4" style={{ gap: 25, background: 'transparent' }}>
        {[
          { key: 'recommended', label: t('browse.for_you') },
          { key: 'popular', label: t('browse.popular') },
          { key: 'recent', label: t('browse.recent') }
        ].map(tab => (
          <button
            key={tab.key}
            className="fw-bold border-0 bg-transparent"
            style={{
              color: activeTab === tab.key ? '#18191a' : '#888',
              fontWeight: 700,
              fontSize: '0.86rem',
              background: 'transparent',
              borderBottom: activeTab === tab.key ? '2px solid #18191a' : '2px solid transparent',
              borderRadius: 0,
              outline: 'none',
              transition: 'color 0.14s, border-bottom 0.14s',
              padding: '0.4rem 0',
              minWidth: 72,
              letterSpacing: '0.16px',
              cursor: 'pointer',
            }}
            onClick={() => navigateToTab(tab.key)}
            onMouseEnter={e => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.color = '#232323';
                e.currentTarget.style.borderBottom = '2px solid #232323';
              }
            }}
            onMouseLeave={e => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.color = '#888';
                e.currentTarget.style.borderBottom = '2px solid transparent';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <CardSection
        title={
          category === 'popular'
            ? t('browse.popular_characters')
            : category === 'recent'
            ? t('browse.recently_uploaded')
            : category === 'recommended'
            ? t('browse.recommended_for_you')
            : ''
        }
      >
        {isLoading ? (
          <div className="text-center my-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">{t('browse.loading')}</span>
            </div>
          </div>
        ) : category === 'recommended' && characters.length === 0 ? (
          <div className="alert alert-info">
            {t('browse.no_recommendations')}
          </div>
        ) : (
          Array.isArray(characters)
            ? characters.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'center', padding: '0 0' }}>
                  <EntityCard type="character" entity={c} />
                </div>
              ))
            : null
        )}
      </CardSection>
    </PageWrapper>
  );
}

export default BrowsePage;