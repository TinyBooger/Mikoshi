import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useTranslation } from 'react-i18next';
import logo from '../assets/images/logo.png';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <div className="mx-auto" style={{ maxWidth: 400, width: '100%' }}>
        <div className="text-center mb-4">
          <img
            src={logo}
            alt="Mikoshi Logo"
            style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 16 }}
          />
          <h1 className="mb-2" style={{ fontWeight: 800, fontSize: '2.4rem', letterSpacing: '-1px' }}>{t('welcome.title')}</h1>
          <p className="text-muted mb-0" style={{ fontSize: '1.15rem', fontWeight: 500 }}>
            {t('welcome.subtitle')}
          </p>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
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
          <button type="submit" className="btn btn-dark w-100">{t('welcome.login')}</button>
        </form>
        <div className="text-center mt-3">
          <span className="me-2">{t('welcome.no_account')}</span>
          <button
            type="button"
            className="btn btn-outline-dark"
            style={{ borderWidth: 2 }}
            onClick={() => navigate('/sign-up')}
          >
            {t('welcome.sign_up')}
          </button>
        </div>
      </div>
    </div>
  );
}