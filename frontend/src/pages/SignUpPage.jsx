import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import PageWrapper from '../components/PageWrapper';
import ImageCropModal from '../components/ImageCropModal';
import { AuthContext } from '../components/AuthProvider';
import PrimaryButton from '../components/PrimaryButton';
import TextButton from '../components/TextButton';

export default function SignUpPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const { register, loading } = useContext(AuthContext);

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!invitationCode.trim()) {
      setError('Invitation code is required');
      return;
    }
    if (!agreedToTerms) {
      setError(t('signup.terms_required'));
      return;
    }
    const success = await register(email, name, password, bio, profileFile, invitationCode);
    if (success) {
      navigate('/', { replace: true });
    } else {
      setError('Registration failed. Please check your invitation code.');
    }
  };

  return (
    <>
      <TextButton
        onClick={handleGoBack}
        style={{ position: 'absolute', top: 24, left: 24, zIndex: 1000 }}
      >
        <span style={{ fontSize: '1.5rem', marginRight: 6 }}>&larr;</span> {t('signup.back')}
      </TextButton>
      <PageWrapper>
        <div className="container">
          <div className="mx-auto" style={{ maxWidth: 400 }}>
            <h2 className="mb-4 text-center fw-bold py-4" style={{ fontWeight: 700, paddingTop: '2rem', paddingBottom: '2rem' }}>{t('signup.title')}</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            {loading && <div className="text-center"><div className="spinner-border text-primary" role="status"></div></div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">{t('signup.invitation_code')}</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  placeholder="Enter your invitation code"
                  style={{ textTransform: 'uppercase' }}
                />
                <small className="form-text text-muted">
                  This is an alpha test. An invitation code is required to sign up.
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
                <label className="form-label">{t('signup.email')}</label>
                <input
                  type="email"
                  className="form-control"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                        alt="Profile preview"
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
    </>
  );
}