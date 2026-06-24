import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import logo from '../assets/images/logo.png';
import { AuthContext } from '../components/AuthProvider';
import { useToast } from '../components/ToastProvider';
import PrimaryButton from '../components/PrimaryButton';
import TextButton from '../components/TextButton';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || null;
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
  
  // 验证码相关状态
  const captchaRef = useRef(null);
  const phoneNumberRef = useRef('');
  const emailRef = useRef('');
  const passwordRef = useRef('');
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaParam, setCaptchaParam] = useState(null);
  const passwordCaptchaRef = useRef(null);
  const [passwordCaptchaVerified, setPasswordCaptchaVerified] = useState(false);
  const [passwordCaptchaParam, setPasswordCaptchaParam] = useState(null);
  const phoneCaptchaInitialized = useRef(false);
  const passwordCaptchaInitialized = useRef(false);

  const handlePasswordLogin = async (account = emailRef.current, pwd = passwordRef.current) => {
    setError('');
    const safeEmail = account?.trim();
    const safePwd = pwd || '';

    if (!safeEmail || !safePwd) {
      const msg = t('welcome.invalid_credentials');
      setError(msg);
      if (toast && toast.show) toast.show(msg, { type: 'error' });
      return;
    }
    const success = await login(safeEmail, safePwd);
    if (success) {
      navigate(from || '/', { replace: true });
    } else {
      const msg = t('welcome.invalid_credentials');
      setError(msg);
      if (toast && toast.show) toast.show(msg, { type: 'error' });
      setPasswordCaptchaVerified(false);
      setPasswordCaptchaParam(null);
    }
  };

  const handlePasswordFormSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (loading) return;

    if (!email.trim() || !password.trim()) {
      const msg = t('welcome.invalid_credentials');
      setError(msg);
      toast?.show(msg, { type: 'error' });
      return;
    }

    if (!passwordCaptchaVerified && passwordCaptchaRef.current) {
      passwordCaptchaRef.current.showCaptcha();
    } else if (passwordCaptchaVerified) {
      handlePasswordLogin(email, password);
    } else {
      handlePasswordLogin(email, password);
    }
  };
  // send code without reload
  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!phoneNumber || countdown > 0) return;
    const result = await sendVerificationCode(phoneNumber);
    if (result.success) {
      setCountdown(60);
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

  // Update ref whenever phoneNumber changes
  useEffect(() => {
    phoneNumberRef.current = phoneNumber;
  }, [phoneNumber]);

  // Keep email/password refs updated for captcha callbacks
  useEffect(() => {
    emailRef.current = email;
  }, [email]);

  useEffect(() => {
    passwordRef.current = password;
  }, [password]);

  // Initialize the relevant captcha after mount and when the active tab changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'phone') {
        initPhoneCaptcha();
      } else {
        initPasswordCaptcha();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeTab]);

  const initPhoneCaptcha = () => {
    if (phoneCaptchaInitialized.current) return;
    if (!window.initAliyunCaptcha) return;
    const buttonEl = document.querySelector('#captcha-button');
    if (!buttonEl) return;

    window.initAliyunCaptcha({
      SceneId: "z6idp2sa", // 根据你的场景ID修改
      mode: "popup",
      element: "#captcha-element",
      button: "#captcha-button",
      success: async (captchaVerifyParam) => {
        setCaptchaVerified(true);
        setCaptchaParam(captchaVerifyParam);
        // 验证成功后自动发送验证码
        const result = await sendVerificationCode(phoneNumberRef.current);
        if (result.success) {
          setCountdown(60);
          if (toast && toast.show) toast.show(result.message || '验证码已发送', { type: 'success' });
        } else {
          if (toast && toast.show) toast.show(result.message || '发送失败', { type: 'error' });
        }
      },
      fail: (failParams) => {
        console.error("验证码验证失败", failParams);
        setCaptchaVerified(false);
      },
      getInstance: (instance) => {
        captchaRef.current = instance;
      },
      slideStyle: {
        width: 360,
        height: 40,
      },
      language: "cn",
    });

    phoneCaptchaInitialized.current = true;
  };

  const initPasswordCaptcha = () => {
    if (passwordCaptchaInitialized.current) return;
    if (!window.initAliyunCaptcha) return;
    const buttonEl = document.querySelector('#password-captcha-button');
    if (!buttonEl) return;

    window.initAliyunCaptcha({
      SceneId: "z6idp2sa", // 根据你的场景ID修改
      mode: "popup",
      element: "#password-captcha-element",
      button: "#password-captcha-button",
      success: async (captchaVerifyParam) => {
        setPasswordCaptchaVerified(true);
        setPasswordCaptchaParam(captchaVerifyParam);
        await handlePasswordLogin(emailRef.current, passwordRef.current);
      },
      fail: (failParams) => {
        console.error("密码登录验证码失败", failParams);
        setPasswordCaptchaVerified(false);
        setPasswordCaptchaParam(null);
      },
      getInstance: (instance) => {
        passwordCaptchaRef.current = instance;
      },
      slideStyle: {
        width: 360,
        height: 40,
      },
      language: "cn",
    });

    passwordCaptchaInitialized.current = true;
  };
  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    
    if (!captchaVerified) {
      // If not verified, trigger captcha manually
      if (captchaRef.current) {
        captchaRef.current.showCaptcha();
      } else {
        const msg = '请先完成人机验证';
        setError(msg);
        toast?.show(msg, { type: 'error' });
      }
      return;
    }
    
    try {
      const result = await verifyPhone(phoneNumber, verificationCode, captchaParam);
      if (result.success) {
        if (result.status === 'existing_user') {
          navigate(from || '/', { replace: true });
        } else if (result.status === 'new_user') {
          navigate(`/sign-up?phone_token=${result.verifiedPhoneToken}&phone=${result.phoneNumber}`);
        }
      } else {
        const msg = result.message || '验证失败';
        setError(msg);
        if (toast && toast.show) toast.show(msg, { type: 'error' });
        resetCaptcha();
      }
    } catch (error) {
      console.error('登录错误:', error);
      const msg = '网络错误，请稍后重试';
      setError(msg);
      if (toast && toast.show) toast.show(msg, { type: 'error' });
      resetCaptcha();
    }
  };

  const resetCaptcha = () => {
    setCaptchaVerified(false);
    setCaptchaParam(null);
    setPasswordCaptchaVerified(false);
    setPasswordCaptchaParam(null);
    
    // Aliyun Captcha SDK 实例可能没有 reset() 方法，
    // 安全地尝试 reload() 或重置初始化状态让 useEffect 重新创建
    if (captchaRef.current) {
      try {
        if (typeof captchaRef.current.reset === 'function') {
          captchaRef.current.reset();
        } else if (typeof captchaRef.current.reload === 'function') {
          captchaRef.current.reload();
        }
      } catch (e) {
        console.warn('Failed to reset phone captcha:', e);
      }
      captchaRef.current = null;
      phoneCaptchaInitialized.current = false;
    }
    if (passwordCaptchaRef.current) {
      try {
        if (typeof passwordCaptchaRef.current.reset === 'function') {
          passwordCaptchaRef.current.reset();
        } else if (typeof passwordCaptchaRef.current.reload === 'function') {
          passwordCaptchaRef.current.reload();
        }
      } catch (e) {
        console.warn('Failed to reset password captcha:', e);
      }
      passwordCaptchaRef.current = null;
      passwordCaptchaInitialized.current = false;
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <style>{`
        .welcome-input-wrapper { position: relative; }
        .welcome-input-wrapper .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
          display: flex;
          align-items: center;
        }
        .welcome-input-wrapper input {
          padding-left: 40px !important;
          border-radius: 999px !important;
        }
        .get-code-btn {
          background: none;
          border: none;
          font-size: 0.84rem;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          transition: color 0.2s ease;
          padding: 0 14px 0 14px;
          flex-shrink: 0;
        }
        .get-code-btn:hover:not(:disabled) {
          color: #6e6394 !important;
        }
      `}</style>

      <div className="mx-auto" style={{ maxWidth: 400, width: '100%' }}>
        {/* Logo & Header */}
        <div className="text-center" style={{ marginBottom: 32 }}>
          <img
            src={logo}
            alt={t('common.logo_alt')}
            style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 20 }}
          />
          <h1 className="mb-2" style={{ fontWeight: 700, fontSize: '2rem', color: '#1a1a2e' }}>
            {t('welcome.title')}
          </h1>
          <p className="text-muted mb-0" style={{ fontSize: '1rem' }}>
            {t('welcome.subtitle')}
          </p>
          <div
            className="mt-3 px-3 py-2 rounded-3"
            style={{ background: '#fff3cd', border: '1px solid #ffc107', fontSize: '0.85rem', color: '#856404' }}
          >
            🚧 <strong>内测阶段</strong>：当前平台处于内测阶段，功能持续完善中，感谢您的支持与反馈！
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {/* Sliding Pill Tabs */}
        <div
          role="tablist"
          style={{
            position: 'relative',
            background: '#e4e4e7',
            borderRadius: 999,
            padding: 4,
            display: 'flex',
            marginBottom: 24,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              width: 'calc(50% - 4px)',
              background: '#c4b8e8',
              borderRadius: 999,
              transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: `translateX(${activeTab === 'phone' ? '0%' : '100%'})`,
              pointerEvents: 'none',
            }}
          />
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'phone'}
            style={{
              flex: 1,
              position: 'relative',
              zIndex: 1,
              border: 'none',
              background: 'transparent',
              borderRadius: 999,
              padding: '0.5rem 0.5rem',
              fontWeight: activeTab === 'phone' ? 600 : 400,
              color: activeTab === 'phone' ? '#fff' : '#8b7db8',
              cursor: 'pointer',
              fontSize: '0.88rem',
              transition: 'color 0.2s ease',
            }}
            onClick={() => setActiveTab('phone')}
          >
            短信验证码登录/快速注册
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'password'}
            style={{
              flex: 1,
              position: 'relative',
              zIndex: 1,
              border: 'none',
              background: 'transparent',
              borderRadius: 999,
              padding: '0.5rem 0.5rem',
              fontWeight: activeTab === 'password' ? 600 : 400,
              color: activeTab === 'password' ? '#fff' : '#8b7db8',
              cursor: 'pointer',
              fontSize: '0.88rem',
              transition: 'color 0.2s ease',
            }}
            onClick={() => setActiveTab('password')}
          >
            账号/密码登录
          </button>
        </div>

        {loading && (
          <div className="text-center mb-3">
            <div className="spinner-border text-secondary" role="status"></div>
          </div>
        )}

        {activeTab === 'phone' ? (
          <form onSubmit={handlePhoneLogin}>
            <div className="mb-3">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #dee2e6',
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: '#fff',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocusCapture={e => {
                  e.currentTarget.style.borderColor = '#9b8ec4';
                  e.currentTarget.style.boxShadow = '0 0 0 0.2rem rgba(155,142,196,0.18)';
                }}
                onBlurCapture={e => {
                  e.currentTarget.style.borderColor = '#dee2e6';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="welcome-input-wrapper" style={{ flex: 1, margin: 0 }}>
                  <span className="input-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                      <line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                  </span>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="请输入手机号"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    pattern="1[3-9][0-9]{9}"
                    style={{ border: 'none', boxShadow: 'none', borderRadius: 0, background: 'transparent' }}
                  />
                </div>
              </div>
            </div>
            <div className="mb-3">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #dee2e6',
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: '#fff',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocusCapture={e => {
                  e.currentTarget.style.borderColor = '#9b8ec4';
                  e.currentTarget.style.boxShadow = '0 0 0 0.2rem rgba(155,142,196,0.18)';
                }}
                onBlurCapture={e => {
                  e.currentTarget.style.borderColor = '#dee2e6';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="welcome-input-wrapper" style={{ flex: 1, margin: 0 }}>
                  <span className="input-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4"/>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="请输入验证码"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    required
                    maxLength={6}
                    style={{ border: 'none', boxShadow: 'none', borderRadius: 0, background: 'transparent' }}
                  />
                </div>
                <div style={{ width: 1, height: 20, background: '#e5e7eb', flexShrink: 0 }} />
                <button
                  id="captcha-button"
                  className="get-code-btn"
                  type="button"
                  disabled={countdown > 0 || !phoneNumber}
                  style={{
                    color: countdown > 0 || !phoneNumber ? '#9ca3af' : '#9b8ec4',
                    cursor: countdown > 0 || !phoneNumber ? 'not-allowed' : 'pointer',
                  }}
                >
                  {countdown > 0 ? `${countdown}秒后重试` : '获取验证码'}
                </button>
              </div>
            </div>

            {/* 阿里云人机验证码容器 */}
            <div id="captcha-element" style={{ display: 'none' }}></div>

            {captchaVerified && activeTab === 'phone' && (
              <div className="text-success small mb-2">✓ 人机验证已通过</div>
            )}

            <PrimaryButton
              type="submit"
              className="w-100"
              disabled={loading || !captchaVerified}
              style={{ padding: '0.65rem', fontSize: '1rem', background: '#7f72a8' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#6e6394'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#7f72a8'; }}
            >
              {loading ? '处理中...' : '登录/注册'}
            </PrimaryButton>
            <div className="text-center mt-3">
              <TextButton onClick={() => navigate('/reset-password')}>
                {t('common.forgot_password')}
              </TextButton>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordFormSubmit}>
            <div className="mb-3">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #dee2e6',
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: '#fff',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocusCapture={e => {
                  e.currentTarget.style.borderColor = '#9b8ec4';
                  e.currentTarget.style.boxShadow = '0 0 0 0.2rem rgba(155,142,196,0.18)';
                }}
                onBlurCapture={e => {
                  e.currentTarget.style.borderColor = '#dee2e6';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="welcome-input-wrapper" style={{ flex: 1, margin: 0 }}>
                  <span className="input-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="邮箱或手机号"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ border: 'none', boxShadow: 'none', borderRadius: 0, background: 'transparent' }}
                  />
                </div>
              </div>
            </div>
            <div className="mb-3">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #dee2e6',
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: '#fff',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocusCapture={e => {
                  e.currentTarget.style.borderColor = '#9b8ec4';
                  e.currentTarget.style.boxShadow = '0 0 0 0.2rem rgba(155,142,196,0.18)';
                }}
                onBlurCapture={e => {
                  e.currentTarget.style.borderColor = '#dee2e6';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="welcome-input-wrapper" style={{ flex: 1, margin: 0 }}>
                  <span className="input-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder={t('welcome.password')}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ border: 'none', boxShadow: 'none', borderRadius: 0, background: 'transparent' }}
                  />
                </div>
              </div>
            </div>

            {/* 阿里云人机验证码容器 - 密码登录 */}
            <div id="password-captcha-element" style={{ display: 'none' }}></div>

            {passwordCaptchaVerified && activeTab === 'password' && (
              <div className="text-success small mb-2">✓ 人机验证已通过</div>
            )}

            <PrimaryButton
              id="password-captcha-button"
              type="button"
              className="w-100"
              disabled={loading}
              style={{ padding: '0.65rem', fontSize: '1rem', background: '#7f72a8' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#6e6394'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#7f72a8'; }}
            >
              {loading ? '处理中...' : t('welcome.login')}
            </PrimaryButton>
            <div className="text-center mt-3">
              <TextButton onClick={() => navigate('/reset-password')}>
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