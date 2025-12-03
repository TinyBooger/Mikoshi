import React, { useContext, useState } from 'react';
import PageWrapper from '../components/PageWrapper';
import { AuthContext } from '../components/AuthProvider';
import { useToast } from '../components/ToastProvider';
import ConfirmModal from '../components/ConfirmModal';
import { useTranslation } from 'react-i18next';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';

export default function SettingsPage() {
  const { userData, sessionToken, refreshUserData, logout } = useContext(AuthContext);
  const toast = useToast();
  const { t, i18n } = useTranslation();

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState({ show: false });
  const [lang, setLang] = useState(i18n.language === 'zh' ? 'zh' : 'en');

  if (!userData) return null;

  const handleLangToggle = (newLang) => {
    i18n.changeLanguage(newLang);
    setLang(newLang);
    toast.show(newLang === 'zh' ? '语言已切换到中文' : 'Language switched to English', { type: 'info' });
  };

  const doChangePassword = async (e) => {
    e?.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t('settings.passwords_no_match'));
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': sessionToken },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
        if (res.ok) {
          toast.show(data.message || t('settings.password_changed'), { type: 'info' });
          setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setShowPasswordForm(false);
        } else {
          const msg = data.detail || data.message || t('settings.failed_change_password');
          setPasswordError(msg);
          toast.show(msg, { type: 'error' });
        }
    } catch (err) {
      toast.show(t('common.network_error'), { type: 'error' });
    } finally {
      setChangingPassword(false);
    }
  };

  const doChangeEmail = async (e) => {
    e?.preventDefault();
    setEmailError('');
    setChangingEmail(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/change-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': sessionToken },
        body: JSON.stringify({ newEmail })
      });
      const data = await res.json();
      if (res.ok) {
        toast.show(data.message || t('settings.email_updated'), { type: 'info' });
        setNewEmail(''); setShowEmailForm(false);
      } else {
        const msg = data.detail || data.message || t('settings.failed_change_email');
        setEmailError(msg);
        toast.show(msg, { type: 'error' });
      }
    } catch (err) {
      toast.show(t('common.network_error'), { type: 'error' });
    } finally {
      setChangingEmail(false);
    }
  };

  const doDeleteAccount = async () => {
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': sessionToken },
        body: JSON.stringify({ confirm: true })
      });
      const data = await res.json();
      if (res.ok) {
        toast.show(data.message || t('settings.account_deletion_scheduled'), { type: 'info' });
        // log user out locally
        logout();
        // navigate to welcome
        window.location.href = '/';
      } else {
        toast.show(data.detail || data.message || t('settings.failed_delete_account'), { type: 'error' });
      }
    } catch (err) {
      toast.show(t('common.network_error'), { type: 'error' });
    }
  };

  return (
    <PageWrapper>
      <div className="container mt-4">
        <h2>{t('settings.title')}</h2>
        <div style={{ maxWidth: 720, marginTop: 16 }}>
          <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
            <h4>{t('settings.language') || 'Language'}</h4>
            <p>{t('settings.current_language') || 'Current language:'} <strong>{lang === 'zh' ? '中文' : 'English'}</strong></p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PrimaryButton 
                onClick={() => handleLangToggle('en')}
                disabled={lang === 'en'}
                style={{ 
                  background: lang === 'en' ? '#736B92' : '#e9ecef',
                  color: lang === 'en' ? '#fff' : '#6c757d',
                  cursor: lang === 'en' ? 'default' : 'pointer'
                }}
              >
                English
              </PrimaryButton>
              <PrimaryButton 
                onClick={() => handleLangToggle('zh')}
                disabled={lang === 'zh'}
                style={{ 
                  background: lang === 'zh' ? '#736B92' : '#e9ecef',
                  color: lang === 'zh' ? '#fff' : '#6c757d',
                  cursor: lang === 'zh' ? 'default' : 'pointer'
                }}
              >
                中文
              </PrimaryButton>
            </div>
          </section>

          <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
            <h4>{t('settings.security')}</h4>
              {!showPasswordForm ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <PrimaryButton onClick={() => setShowPasswordForm(true)}>{t('settings.change_password')}</PrimaryButton>
              </div>
            ) : (
              <form onSubmit={doChangePassword}>
                <div className="mb-2">
                  <label className="form-label">{t('settings.current_password')}</label>
                  <input type="password" className="form-control" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                </div>
                <div className="mb-2">
                  <label className="form-label">{t('settings.new_password')}</label>
                  <input type="password" className="form-control" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                </div>
                <div className="mb-2">
                  <label className="form-label">{t('settings.confirm_new_password')}</label>
                  <input type="password" className="form-control" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required />
                </div>
                {passwordError && (
                  <div className="text-danger mb-2" style={{ fontSize: '0.95rem' }}>{passwordError}</div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <PrimaryButton type="submit" disabled={changingPassword}>{t('settings.change_password')}</PrimaryButton>
                  <SecondaryButton type="button" onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); }}>{t('common.cancel')}</SecondaryButton>
                </div>
              </form>
            )}
          </section>

          <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
            <h4>{t('settings.change_email')}</h4>
            <p>{t('settings.current_email')} <strong>{userData.email}</strong></p>
              {!showEmailForm ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <PrimaryButton onClick={() => setShowEmailForm(true)}>{t('settings.change_email')}</PrimaryButton>
              </div>
            ) : (
              <form onSubmit={doChangeEmail}>
                <div className="mb-2">
                  <label className="form-label">{t('welcome.email') || 'New email'}</label>
                  <input type="email" className="form-control" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <PrimaryButton type="submit" disabled={changingEmail}>{t('settings.change_email')}</PrimaryButton>
                  <SecondaryButton type="button" onClick={() => { setShowEmailForm(false); setNewEmail(''); setEmailError(''); }}>{t('common.cancel')}</SecondaryButton>
                </div>
                {emailError && (
                  <div className="text-danger mt-2" style={{ fontSize: '0.95rem' }}>{emailError}</div>
                )}
              </form>
            )}
          </section>

          <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
            <h4 className="text-danger">{t('settings.danger_zone')}</h4>
            <p className="text-muted">{t('settings.delete_account_confirm')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <PrimaryButton 
                onClick={() => setConfirmDelete({ show: true })}
                style={{ background: '#d32f2f', color: '#fff' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#b71c1c'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#d32f2f'; }}
              >
                {t('settings.delete_account')}
              </PrimaryButton>
            </div>
          </section>
        </div>
      </div>

  <ConfirmModal show={confirmDelete.show} title={t('settings.delete_account')} message={t('settings.delete_account_confirm')} onCancel={() => setConfirmDelete({ show: false })} onConfirm={() => { setConfirmDelete({ show: false }); doDeleteAccount(); }} confirmText={t('common.delete')} cancelText={t('common.cancel')} />
    </PageWrapper>
  );
}
