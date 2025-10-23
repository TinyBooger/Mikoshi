import React, { useContext, useState } from 'react';
import PageWrapper from '../components/PageWrapper';
import { AuthContext } from '../components/AuthProvider';
import { useToast } from '../components/ToastProvider';
import ConfirmModal from '../components/ConfirmModal';
import { useTranslation } from 'react-i18next';

export default function SettingsPage() {
  const { userData, sessionToken, refreshUserData, logout } = useContext(AuthContext);
  const toast = useToast();
  const { t } = useTranslation();

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

  if (!userData) return null;

  const doChangePassword = async (e) => {
    e?.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
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
          toast.show(data.message || 'Password changed', { type: 'info' });
          setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setShowPasswordForm(false);
        } else {
          const msg = data.detail || data.message || 'Failed to change password';
          setPasswordError(msg);
          toast.show(msg, { type: 'error' });
        }
    } catch (err) {
      toast.show('Network error', { type: 'error' });
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
        toast.show(data.message || 'Email updated', { type: 'info' });
        setNewEmail(''); setShowEmailForm(false);
      } else {
        const msg = data.detail || data.message || 'Failed to change email';
        setEmailError(msg);
        toast.show(msg, { type: 'error' });
      }
    } catch (err) {
      toast.show('Network error', { type: 'error' });
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
        toast.show(data.message || 'Account deletion scheduled', { type: 'info' });
        // log user out locally
        logout();
        // navigate to welcome
        window.location.href = '/';
      } else {
        toast.show(data.detail || data.message || 'Failed to delete account', { type: 'error' });
      }
    } catch (err) {
      toast.show('Network error', { type: 'error' });
    }
  };

  return (
    <PageWrapper>
      <div className="container mt-4">
        <h2>{t('settings.title')}</h2>
        <div style={{ maxWidth: 720, marginTop: 16 }}>
          <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
            <h4>{t('settings.security')}</h4>
              {!showPasswordForm ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline-dark" onClick={() => setShowPasswordForm(true)}>{t('settings.change_password')}</button>
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
                  <button className="btn btn-dark" type="submit" disabled={changingPassword}>{t('settings.change_password')}</button>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); }}>{t('common.cancel')}</button>
                </div>
              </form>
            )}
          </section>

          <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
            <h4>{t('settings.change_email')}</h4>
            <p>{t('settings.current_email')} <strong>{userData.email}</strong></p>
              {!showEmailForm ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline-dark" onClick={() => setShowEmailForm(true)}>{t('settings.change_email')}</button>
              </div>
            ) : (
              <form onSubmit={doChangeEmail}>
                <div className="mb-2">
                  <label className="form-label">{t('welcome.email') || 'New email'}</label>
                  <input type="email" className="form-control" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-dark" type="submit" disabled={changingEmail}>{t('settings.change_email')}</button>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => { setShowEmailForm(false); setNewEmail(''); setEmailError(''); }}>{t('common.cancel')}</button>
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
              <button className="btn btn-outline-danger" onClick={() => setConfirmDelete({ show: true })}>{t('settings.delete_account')}</button>
            </div>
          </section>
        </div>
      </div>

  <ConfirmModal show={confirmDelete.show} title={t('settings.delete_account')} message={t('settings.delete_account_confirm')} onCancel={() => setConfirmDelete({ show: false })} onConfirm={() => { setConfirmDelete({ show: false }); doDeleteAccount(); }} confirmText={t('common.delete')} cancelText={t('common.cancel')} />
    </PageWrapper>
  );
}
