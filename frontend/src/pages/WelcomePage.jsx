import React, { useState, useContext, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading, sendVerificationCode, verifyPhone } = useContext(AuthContext);
  const toast = useToast();
  // phone login state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState('');

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
  // send code without reload
  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!phoneNumber || countdown > 0) return;
    const result = await sendVerificationCode(phoneNumber);
    if (result.success) {
      setCountdown(60);
      if (result.code) setDevCode(result.code);
      if (toast && toast.show) toast.show(result.message || '验证码已发送', { type: 'success' });
    } else {
      if (toast && toast.show) toast.show(result.message || '发送失败', { type: 'error' });
    }
  };
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);
  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    const result = await verifyPhone(phoneNumber, verificationCode);
    if (result.success) {
      if (result.status === 'existing_user') {
        navigate('/');
      } else if (result.status === 'new_user') {
        navigate(`/sign-up?phone_token=${result.verifiedPhoneToken}&phone=${result.phoneNumber}`);
      }
    } else {
      const msg = result.message || '验证失败';
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
        {/* Tabs */}
        <div className="d-flex mb-4" style={{ borderBottom: '1px solid #e9ecef', gap: 0 }} role="tablist">
          <button
            type="button"
            className="flex-grow-1 py-2"
            style={{
              border: 'none',
              background: 'none',
              fontWeight: activeTab === 'phone' ? 600 : 400,
              color: activeTab === 'phone' ? '#0d6efd' : '#adb5bd',
              borderBottom: activeTab === 'phone' ? '3px solid #0d6efd' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '1rem',
              paddingBottom: '0.5rem'
            }}
            onClick={() => setActiveTab('phone')}
          >
            手机号登录
          </button>
          <button
            type="button"
            className="flex-grow-1 py-2"
            style={{
              border: 'none',
              background: 'none',
              fontWeight: activeTab === 'password' ? 600 : 400,
              color: activeTab === 'password' ? '#0d6efd' : '#adb5bd',
              borderBottom: activeTab === 'password' ? '3px solid #0d6efd' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '1rem',
              paddingBottom: '0.5rem'
            }}
            onClick={() => setActiveTab('password')}
          >
            账号/密码登录
          </button>
        </div>
  {loading && <div className="text-center"><div className="spinner-border text-primary" role="status"></div></div>}
        {activeTab === 'phone' ? (
          <form onSubmit={handlePhoneLogin}>
            <div className="mb-3">
              <label className="form-label">手机号</label>
              <input
                type="tel"
                className="form-control"
                placeholder="请输入手机号"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                pattern="1[3-9][0-9]{9}"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">验证码</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="请输入验证码"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  maxLength={6}
                />
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || !phoneNumber}
                >
                  {countdown > 0 ? `${countdown}秒后重试` : '获取验证码'}
                </button>
              </div>
              {devCode && (
                <small className="text-muted">开发环境验证码：{devCode}</small>
              )}
            </div>
            <PrimaryButton type="submit" className="w-100" disabled={loading}>
              {loading ? '处理中...' : '登录/注册'}
            </PrimaryButton>
            <div className="text-center mt-3">
              <TextButton
                onClick={() => navigate('/reset-password')}
              >
                {t('common.forgot_password')}
              </TextButton>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">邮箱或手机号</label>
              <input
                type="text"
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
            <div className="text-center mt-3">
              <TextButton
                onClick={() => navigate('/reset-password')}
              >
                {t('common.forgot_password')}
              </TextButton>
            </div>
          </form>
        )}
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