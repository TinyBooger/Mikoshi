import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

export default function PrivacyPolicyPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isChinese = i18n.language === 'zh';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#222', 
            fontWeight: 600, 
            fontSize: '1rem', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: '2rem'
          }}
        >
          <span style={{ fontSize: '1.5rem', marginRight: 6 }}>&larr;</span> {t('common.back')}
        </button>

        <div style={{ backgroundColor: 'white', padding: '3rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h1 className="mb-4">{t('privacy.title')}</h1>
          <p className="text-muted mb-4">{t('privacy.last_updated')}: 2025-11-17</p>

          <section className="mb-4">
            <h2 className="h4 mb-3">{t('privacy.intro.title')}</h2>
            <p>{t('privacy.intro.content')}</p>
          </section>

          {isChinese ? (
            <>
              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.collection.title')}</h2>
                <p>{t('privacy.collection.content')}</p>
                <p><strong>{t('privacy.collection.provided_title')}：</strong>{t('privacy.collection.provided_content')}</p>
                <p><strong>{t('privacy.collection.generated_title')}：</strong>{t('privacy.collection.generated_content')}</p>
                <ul>
                  <li><strong>{t('privacy.collection.chat_title')}：</strong>{t('privacy.collection.chat_content')}</li>
                  <li><strong>{t('privacy.collection.device_title')}：</strong>{t('privacy.collection.device_content')}</li>
                </ul>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.usage.title')}</h2>
                <p>{t('privacy.usage.content')}</p>
                <ul>
                  <li><strong>{t('privacy.usage.purpose1_title')}：</strong>{t('privacy.usage.purpose1_content')}</li>
                  <li><strong>{t('privacy.usage.purpose2_title')}：</strong>{t('privacy.usage.purpose2_content')}</li>
                  <li><strong>{t('privacy.usage.purpose3_title')}：</strong>{t('privacy.usage.purpose3_content')}</li>
                </ul>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.sharing.title')}</h2>
                <p>{t('privacy.sharing.content')}</p>
                <p>{t('privacy.sharing.promise1')}</p>
                <p>{t('privacy.sharing.promise2')}</p>
                <p>{t('privacy.sharing.exception1')}</p>
                <p>{t('privacy.sharing.exception2')}</p>
                <p>{t('privacy.sharing.exception3')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.security.title')}</h2>
                <p>{t('privacy.security.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.storage.title')}</h2>
                <p><strong>{t('privacy.storage.location_title')}：</strong>{t('privacy.storage.location_content')}</p>
                <p><strong>{t('privacy.storage.retention_title')}：</strong>{t('privacy.storage.retention_content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.your_rights.title')}</h2>
                <p>{t('privacy.your_rights.content')}</p>
                <ul>
                  <li>{t('privacy.your_rights.right1')}</li>
                  <li>{t('privacy.your_rights.right2')}</li>
                  <li>{t('privacy.your_rights.right3')}</li>
                </ul>
                <p>{t('privacy.your_rights.contact')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.minors.title')}</h2>
                <p>{t('privacy.minors.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.changes.title')}</h2>
                <p>{t('privacy.changes.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.contact.title')}</h2>
                <p>{t('privacy.contact.content')}</p>
              </section>
            </>
          ) : (
            <>
              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.collection.title')}</h2>
                <p>{t('privacy.collection.content')}</p>
                <ul>
                  <li><strong>{t('privacy.collection.account_title')}:</strong> {t('privacy.collection.account_content')}</li>
                  <li><strong>{t('privacy.collection.profile_title')}:</strong> {t('privacy.collection.profile_content')}</li>
                  <li><strong>{t('privacy.collection.content_title')}:</strong> {t('privacy.collection.content_content')}</li>
                  <li><strong>{t('privacy.collection.usage_title')}:</strong> {t('privacy.collection.usage_content')}</li>
                </ul>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.usage.title')}</h2>
                <p>{t('privacy.usage.content')}</p>
                <ul>
                  <li>{t('privacy.usage.item1')}</li>
                  <li>{t('privacy.usage.item2')}</li>
                  <li>{t('privacy.usage.item3')}</li>
                  <li>{t('privacy.usage.item4')}</li>
                  <li>{t('privacy.usage.item5')}</li>
                </ul>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.sharing.title')}</h2>
                <p>{t('privacy.sharing.content')}</p>
                <ul>
                  <li>{t('privacy.sharing.item1')}</li>
                  <li>{t('privacy.sharing.item2')}</li>
                  <li>{t('privacy.sharing.item3')}</li>
                </ul>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.security.title')}</h2>
                <p>{t('privacy.security.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.cookies.title')}</h2>
                <p>{t('privacy.cookies.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.your_rights.title')}</h2>
                <p>{t('privacy.your_rights.content')}</p>
                <ul>
                  <li>{t('privacy.your_rights.item1')}</li>
                  <li>{t('privacy.your_rights.item2')}</li>
                  <li>{t('privacy.your_rights.item3')}</li>
                  <li>{t('privacy.your_rights.item4')}</li>
                </ul>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.children.title')}</h2>
                <p>{t('privacy.children.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.changes.title')}</h2>
                <p>{t('privacy.changes.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('privacy.contact.title')}</h2>
                <p>{t('privacy.contact.content')}</p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
