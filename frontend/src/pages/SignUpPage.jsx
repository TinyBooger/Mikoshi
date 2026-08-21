import React, { useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import PageWrapper from '../components/PageWrapper';
import ImageCropModal from '../components/ImageCropModal';
import { AuthContext } from '../components/AuthProvider';
import PrimaryButton from '../components/PrimaryButton';
import TextButton from '../components/TextButton';

export default function SignUpPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get phone registration parameters
  const phoneToken = searchParams.get('phone_token');
  const phoneNumber = searchParams.get('phone');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [bio, setBio] = useState('');
  const [profileFile, setProfileFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [showCrop, setShowCrop] = useState(false);
  const [rawSelectedFile, setRawSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { registerWithPhone, loading } = useContext(AuthContext);

  const handleGoBack = () => {
    navigate(-1);
  };

  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    const classes = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

    // Only one character type (e.g. all digits or all lowercase) => weak regardless of length
    if (classes <= 1) return 1;

    let score = 1;
    if (pwd.length >= 8) score += 1;
    if (classes >= 2) score += 1;
    if (classes >= 3) score += 1;
    return Math.min(score, 4);
  };

  const passwordStrength = getPasswordStrength(password);
  const MAX_PASSWORD_LENGTH = 64;
  const isPasswordAtMax = password.length >= MAX_PASSWORD_LENGTH;
  const strengthMeta = [
    { label: '', color: '#e9ecef' },
    { label: '弱', color: '#e53e3e' },
    { label: '一般', color: '#ed8936' },
    { label: '强', color: '#38a169' },
    { label: '很强', color: '#2f855a' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate password confirmation
    if (password !== confirmPassword) {
      setError(t('signup.passwords_no_match'));
      return;
    }
    
    // Validate terms
    if (!agreedToTerms) {
      setError(t('signup.terms_required'));
      return;
    }
    
    const success = await registerWithPhone(phoneToken, name, invitationCode, bio, email, password, profileFile);
    if (success.success) {
      navigate('/', { replace: true });
    } else {
      setError(success.message || t('signup.registration_failed'));
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'auto',
    }}>
      <PageWrapper style={{ background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
        <div className="container" style={{ paddingBottom: '3rem' }}>
          <div className="mx-auto" style={{ maxWidth: 400 }}>
            <TextButton
              onClick={handleGoBack}
              style={{ display: 'block', marginBottom: '0.5rem' }}
            >
              <span style={{ fontSize: '1.5rem', marginRight: 6 }}>&larr;</span> {t('signup.back')}
            </TextButton>
            {error && <div className="alert alert-danger">{error}</div>}
            {loading && <div className="text-center"><div className="spinner-border text-primary" role="status"></div></div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <div className="d-flex justify-content-center">
                  <label
                    style={{
                      position: 'relative',
                      width: 96,
                      height: 96,
                      borderRadius: '50%',
                      overflow: 'visible',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                        if (f) {
                          setRawSelectedFile(f);
                          setShowCrop(true);
                        } else {
                          setRawSelectedFile(null);
                          setProfileFile(null);
                          setProfilePreview(null);
                        }
                      }}
                    />
                    <div
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '2px solid #e9ecef',
                        background: '#f8f9fa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {profilePreview ? (
                        <img
                          src={profilePreview}
                          alt={t('signup.profile_preview')}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ color: '#adb5bd', fontSize: '1.5rem' }}>+</span>
                      )}
                    </div>
                    <span
                      style={{
                        position: 'absolute',
                        right: 0,
                        bottom: 0,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#fff',
                        border: '2px solid #e9ecef',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    >
                      ✏️
                    </span>
                  </label>
                </div>
              </div>
              <p className="form-text mb-3 text-end" style={{ color: '#6c757d' }}><span style={{ color: '#e53e3e' }}>*</span> 代表必填项</p>
              <div className="mb-3">
                <label className="form-label">昵称 <span style={{ color: '#e53e3e' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">手机号 <span style={{ color: '#e53e3e' }}>*</span></label>
                <input
                  type="text"
                  name="phone"
                  autoComplete="tel"
                  className="form-control"
                  value={phoneNumber}
                  disabled
                  style={{ backgroundColor: '#f0f0f0' }}
                />
                <small className="form-text text-muted">已验证</small>
              </div>
              <div className="mb-3">
                <label className="form-label">
                  {t('signup.email')} <span className="text-muted">（可选）</span>
                </label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">{t('signup.password')} <span style={{ color: '#e53e3e' }}>*</span></label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength="6"
                  maxLength={MAX_PASSWORD_LENGTH}
                />
                {password && (
                  <div className="mt-2">
                    <div className="d-flex" style={{ gap: 4 }}>
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          style={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            background: level <= passwordStrength ? strengthMeta[passwordStrength].color : '#e9ecef',
                            transition: 'background 0.2s ease',
                          }}
                        />
                      ))}
                    </div>
                    <div className="d-flex justify-content-between mt-1">
                      <small className="form-text" style={{ color: strengthMeta[passwordStrength].color }}>
                        密码强度：{strengthMeta[passwordStrength].label}
                      </small>
                      <small className="form-text" style={{ color: isPasswordAtMax ? '#e53e3e' : '#6c757d' }}>
                        {isPasswordAtMax ? '已达到最大长度' : ''}
                      </small>
                    </div>
                  </div>
                )}
              </div>
              <div className="mb-3">
                <label className="form-label">{t('signup.confirm_password')} <span style={{ color: '#e53e3e' }}>*</span></label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength="6"
                  autoComplete="new-password"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">{t('signup.short_bio')} <span className="text-muted">（可选）</span></label>
                <textarea
                  className="form-control"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  maxLength={200}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">{t('signup.invitation_code')} <span className="text-muted">（可选）</span></label>
                <input
                  type="text"
                  className="form-control"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }}
                />
                <small className="form-text" style={{ color: '#7c3aed', fontWeight: 500 }}>
                  🎁 使用好友邀请码注册可获赠 <strong>100 点数</strong> 用于聊天
                </small>
              </div>
              <div className="mb-3">
                <div className="form-check d-flex align-items-start gap-2">
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    id="termsCheckbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    required
                    style={{ width: '1.25em', height: '1.25em', flexShrink: 0 }}
                  />
                  <label className="form-check-label" htmlFor="termsCheckbox" style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>
                    {t('signup.agree_to_terms_prefix')}{' '}
                    <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', textDecoration: 'none' }}>
                      {t('signup.terms_link')}
                    </a>
                    {' '}{t('signup.and')}{' '}
                    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', textDecoration: 'none' }}>
                      {t('signup.privacy_link')}
                    </a>
                  </label>
                </div>
              </div>
              <PrimaryButton type="submit" className="w-100">{t('signup.submit')}</PrimaryButton>
            </form>
          </div>
        </div>
      </PageWrapper>
        {showCrop && rawSelectedFile && (
          <ImageCropModal
            srcFile={rawSelectedFile}
            onCancel={() => { setShowCrop(false); setRawSelectedFile(null); }}
            onSave={({ file, dataUrl }) => {
              setProfileFile(file);
              setProfilePreview(dataUrl);
              setShowCrop(false);
              setRawSelectedFile(null);
            }}
            size={96}
          />
        )}
    </div>
  );
}