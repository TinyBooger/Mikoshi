import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

export default function TermsOfServicePage() {
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
          <h1 className="mb-4">{t('terms.title')}</h1>
          <p className="text-muted mb-4">{t('terms.last_updated')}: 2025-11-17</p>

          {isChinese ? (
            <>
              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.header.title')}</h2>
                <p>{t('terms.header.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.general.title')}</h2>
                <p>{t('terms.general.content1')}</p>
                <p>{t('terms.general.content2')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.service.title')}</h2>
                <p>{t('terms.service.content1')}</p>
                <p>{t('terms.service.content2')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.conduct.title')}</h2>
                <p>{t('terms.conduct.content1')}</p>
                <p>{t('terms.conduct.prohibited1')}</p>
                <p>{t('terms.conduct.prohibited2')}</p>
                <p>{t('terms.conduct.prohibited3')}</p>
                <p>{t('terms.conduct.prohibited4')}</p>
                <p>{t('terms.conduct.prohibited5')}</p>
                <p>{t('terms.conduct.content2')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.intellectual_property.title')}</h2>
                <p>{t('terms.intellectual_property.content1')}</p>
                <p>{t('terms.intellectual_property.content2')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.disclaimer.title')}</h2>
                <p>{t('terms.disclaimer.content1')}</p>
                <p>{t('terms.disclaimer.content2')}</p>
                <p>{t('terms.disclaimer.reason1')}</p>
                <p>{t('terms.disclaimer.reason2')}</p>
                <p>{t('terms.disclaimer.reason3')}</p>
                <p>{t('terms.disclaimer.reason4')}</p>
                <p>{t('terms.disclaimer.reason5')}</p>
                <p>{t('terms.disclaimer.content3')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.privacy_reference.title')}</h2>
                <p>{t('terms.privacy_reference.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.changes.title')}</h2>
                <p>{t('terms.changes.content1')}</p>
                <p>{t('terms.changes.content2')}</p>
                <p>{t('terms.changes.content3')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.other.title')}</h2>
                <p>{t('terms.other.content1')}</p>
                <p>{t('terms.other.content2')}</p>
              </section>
            </>
          ) : (
            <>
              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.acceptance.title')}</h2>
                <p>{t('terms.acceptance.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.service_description.title')}</h2>
                <p>{t('terms.service_description.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.user_accounts.title')}</h2>
                <p>{t('terms.user_accounts.content')}</p>
                <ul>
                  <li>{t('terms.user_accounts.responsibility1')}</li>
                  <li>{t('terms.user_accounts.responsibility2')}</li>
                  <li>{t('terms.user_accounts.responsibility3')}</li>
                </ul>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.user_content.title')}</h2>
                <p>{t('terms.user_content.content')}</p>
                <ul>
                  <li>{t('terms.user_content.prohibited1')}</li>
                  <li>{t('terms.user_content.prohibited2')}</li>
                  <li>{t('terms.user_content.prohibited3')}</li>
                  <li>{t('terms.user_content.prohibited4')}</li>
                </ul>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.intellectual_property.title')}</h2>
                <p>{t('terms.intellectual_property.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.prohibited_conduct.title')}</h2>
                <ul>
                  <li>{t('terms.prohibited_conduct.item1')}</li>
                  <li>{t('terms.prohibited_conduct.item2')}</li>
                  <li>{t('terms.prohibited_conduct.item3')}</li>
                  <li>{t('terms.prohibited_conduct.item4')}</li>
                  <li>{t('terms.prohibited_conduct.item5')}</li>
                </ul>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.termination.title')}</h2>
                <p>{t('terms.termination.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.disclaimer.title')}</h2>
                <p>{t('terms.disclaimer.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.limitation.title')}</h2>
                <p>{t('terms.limitation.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.changes.title')}</h2>
                <p>{t('terms.changes.content')}</p>
              </section>

              <section className="mb-4">
                <h2 className="h4 mb-3">{t('terms.contact.title')}</h2>
                <p>{t('terms.contact.content')}</p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
