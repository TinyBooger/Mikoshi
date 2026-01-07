import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import logo from '../assets/images/logo.png';
import { AuthContext } from '../components/AuthProvider';
import { useToast } from '../components/ToastProvider';
import PrimaryButton from '../components/PrimaryButton';
import TextButton from '../components/TextButton';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useContext(AuthContext);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const success = await login(email, password);
    if (success) {
      navigate('/');
    } else {
      const msg = t('welcome.invalid_credentials', 'Invalid email or password');
      setError(msg);
      if (toast && toast.show) toast.show(msg, { type: 'error' });
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <div className="mx-auto" style={{ maxWidth: 400, width: '100%' }}>
        <div className="text-center mb-4">
          <img
            src={logo}
            alt={t('common.logo_alt')}
            style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 16 }}
          />
          <h1 className="mb-2" style={{ fontWeight: 800, fontSize: '2.4rem', letterSpacing: '-1px' }}>{t('welcome.title')}</h1>
          <p className="text-muted mb-0" style={{ fontSize: '1.15rem', fontWeight: 500 }}>
            {t('welcome.subtitle')}
          </p>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="text-center mt-3">
          <TextButton
            onClick={() => navigate('/reset-password')}
          >
            {t('common.forgot_password')}
          </TextButton>
        </div>
  {loading && <div className="text-center"><div className="spinner-border text-primary" role="status"></div></div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">{t('welcome.email')}</label>
            <input
              type="email"
              className="form-control"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">{t('welcome.password')}</label>
            <input
              type="password"
              className="form-control"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <PrimaryButton type="submit" className="w-100">{t('welcome.login')}</PrimaryButton>
        </form>
        <div className="text-center mt-3">
          <span className="me-2">{t('welcome.no_account')}</span>
          <PrimaryButton
            onClick={() => navigate('/sign-up')}
          >
            {t('welcome.sign_up')}
          </PrimaryButton>
        </div>
      </div>

      {/* ICP filing - subtle fixed footer */}
      <div
        style={{
          position: 'fixed',
          bottom: '12px',
          left: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: '0.8rem',
            color: '#adb5bd',
            opacity: 0.8,
            textDecoration: 'none',
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.6)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            pointerEvents: 'auto',
            backdropFilter: 'blur(8px)',
          }}
        >
          滇ICP备2025072925号
        </a>
      </div>
    </div>
  );
}