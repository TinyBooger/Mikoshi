import React, { useState, useContext, useEffect } from 'react';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate password confirmation
    if (password !== confirmPassword) {
      setError(t('signup.passwords_no_match'));
      return;
    }
    
    // Validate invitation code
    if (!invitationCode.trim()) {
      setError(t('signup.invitation_code_required'));
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
      paddingTop: '60px',
    }}>
      <TextButton
        onClick={handleGoBack}
        style={{ position: 'absolute', top: 24, left: 24, zIndex: 1000 }}
      >
        <span style={{ fontSize: '1.5rem', marginRight: 6 }}>&larr;</span> {t('signup.back')}
      </TextButton>
      <PageWrapper>
        <div className="container" style={{ paddingBottom: '3rem' }}>
          <div className="mx-auto" style={{ maxWidth: 400 }}>
            <h2 className="mb-4 text-center fw-bold py-4" style={{ fontWeight: 700, paddingTop: '2rem', paddingBottom: '2rem' }}>
              完成注册
            </h2>
            {error && <div className="alert alert-danger">{error}</div>}
            {loading && <div className="text-center"><div className="spinner-border text-primary" role="status"></div></div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">手机号</label>
                <input
                  type="text"
                  className="form-control"
                  value={phoneNumber}
                  disabled
                  style={{ backgroundColor: '#f0f0f0' }}
                />
                <small className="form-text text-muted">已验证</small>
              </div>
              <div className="mb-3">
                <label className="form-label">{t('signup.invitation_code')}</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  placeholder={t('signup.invitation_code_placeholder')}
                  style={{ textTransform: 'uppercase' }}
                />
                <small className="form-text text-muted">
                  {t('signup.invitation_code_hint')}
                </small>
              </div>
              <div className="mb-3">
                <label className="form-label">{t('signup.name')}</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">
                  {t('signup.email')} 
                  <span className="text-muted" style={{ fontWeight: 400, fontSize: '0.9em' }}> {t('signup.optional')}</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="可选，用于找回账号"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">{t('signup.password')}</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength="6"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">{t('signup.confirm_password')}</label>
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
                <label className="form-label">{t('signup.short_bio')} <span className="text-muted" style={{ fontWeight: 400, fontSize: '0.9em' }}>{t('signup.optional')}</span></label>
                <textarea
                  className="form-control"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder={t('signup.bio_placeholder')}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">{t('signup.profile_picture')} <span className="text-muted" style={{ fontWeight: 400, fontSize: '0.9em' }}>{t('signup.optional')}</span></label>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '2px solid #e9ecef', background: '#fff' }}>
                    {profilePreview && (
                      <img
                        src={profilePreview}
                        alt={t('signup.profile_preview')}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      className="form-control"
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
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="termsCheckbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    required
                  />
                  <label className="form-check-label" htmlFor="termsCheckbox" style={{ fontSize: '0.9rem' }}>
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