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

  const [activeSection, setActiveSection] = useState('account');

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

  // Phone change states
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [phoneChangeStep, setPhoneChangeStep] = useState(1); // 1: verify current, 2: enter new, 3: verify new
  const [currentPhoneCode, setCurrentPhoneCode] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newPhoneCode, setNewPhoneCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const [confirmDelete, setConfirmDelete] = useState({ show: false });
  const [lang, setLang] = useState(i18n.language === 'zh' ? 'zh' : 'en');

  if (!userData) return null;

  console.log('SettingsPage userData:', userData);

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

  // Phone change handlers
  const startPhoneChange = () => {
    setShowPhoneForm(true);
    setPhoneChangeStep(1);
    setCurrentPhoneCode('');
    setNewPhoneNumber('');
    setNewPhoneCode('');
    setPhoneError('');
  };

  const sendCodeToCurrentPhone = async () => {
    setSendingCode(true);
    setPhoneError('');
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/change-phone/send-current-code`, {
        method: 'POST',
        headers: { 'Authorization': sessionToken }
      });
      const data = await res.json();
      if (res.ok) {
        toast.show(data.message || t('settings.code_sent'), { type: 'info' });
        startResendTimer();
      } else {
        const msg = data.detail || data.message || '发送验证码失败';
        setPhoneError(msg);
        toast.show(msg, { type: 'error' });
      }
    } catch (err) {
      toast.show(t('common.network_error'), { type: 'error' });
    } finally {
      setSendingCode(false);
    }
  };

  const verifyCurrentPhone = async () => {
    setVerifyingCode(true);
    setPhoneError('');
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/change-phone/verify-current`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': sessionToken },
        body: JSON.stringify({ code: currentPhoneCode })
      });
      const data = await res.json();
      if (res.ok) {
        toast.show(data.message || t('settings.code_verified'), { type: 'success' });
        setPhoneChangeStep(2);
        setCurrentPhoneCode('');
      } else {
        const msg = data.detail || data.message || t('settings.invalid_code');
        setPhoneError(msg);
        toast.show(msg, { type: 'error' });
      }
    } catch (err) {
      toast.show(t('common.network_error'), { type: 'error' });
    } finally {
      setVerifyingCode(false);
    }
  };

  const sendCodeToNewPhone = async () => {
    if (!newPhoneNumber || !/^1[3-9]\d{9}$/.test(newPhoneNumber)) {
      setPhoneError(t('settings.invalid_phone_format'));
      return;
    }
    setSendingCode(true);
    setPhoneError('');
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/change-phone/send-new-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': sessionToken },
        body: JSON.stringify({ newPhone: newPhoneNumber })
      });
      const data = await res.json();
      if (res.ok) {
        toast.show(data.message || t('settings.code_sent'), { type: 'info' });
        setPhoneChangeStep(3);
        startResendTimer();
      } else {
        const msg = data.detail || data.message || '发送验证码失败';
        setPhoneError(msg);
        toast.show(msg, { type: 'error' });
      }
    } catch (err) {
      toast.show(t('common.network_error'), { type: 'error' });
    } finally {
      setSendingCode(false);
    }
  };

  const confirmPhoneChange = async () => {
    setVerifyingCode(true);
    setPhoneError('');
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/change-phone/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': sessionToken },
        body: JSON.stringify({ newPhone: newPhoneNumber, code: newPhoneCode })
      });
      const data = await res.json();
      if (res.ok) {
        toast.show(data.message || t('settings.phone_change_success'), { type: 'success' });
        setShowPhoneForm(false);
        refreshUserData();
      } else {
        const msg = data.detail || data.message || t('settings.phone_change_failed');
        setPhoneError(msg);
        toast.show(msg, { type: 'error' });
      }
    } catch (err) {
      toast.show(t('common.network_error'), { type: 'error' });
    } finally {
      setVerifyingCode(false);
    }
  };

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelPhoneChange = () => {
    setShowPhoneForm(false);
    setPhoneChangeStep(1);
    setCurrentPhoneCode('');
    setNewPhoneNumber('');
    setNewPhoneCode('');
    setPhoneError('');
  };

  return (
    <PageWrapper>
      <div className="container mt-4">
        <h2>{t('settings.title')}</h2>
        <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
          {/* Sidebar Navigator */}
          <div style={{ 
            minWidth: 200, 
            height: 'fit-content',
            position: 'sticky',
            top: 24
          }}>
            <nav style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 8,
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e9ecef',
              padding: 12
            }}>
              <button
                onClick={() => setActiveSection('account')}
                style={{
                  padding: '12px 16px',
                  border: 'none',
                  background: activeSection === 'account' ? '#f0eef7' : 'transparent',
                  color: activeSection === 'account' ? '#736B92' : '#6c757d',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: activeSection === 'account' ? 600 : 400,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== 'account') {
                    e.currentTarget.style.background = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== 'account') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                账号
              </button>
              <button
                onClick={() => setActiveSection('language')}
                style={{
                  padding: '12px 16px',
                  border: 'none',
                  background: activeSection === 'language' ? '#f0eef7' : 'transparent',
                  color: activeSection === 'language' ? '#736B92' : '#6c757d',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: activeSection === 'language' ? 600 : 400,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== 'language') {
                    e.currentTarget.style.background = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== 'language') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                语言
              </button>
            </nav>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, maxWidth: 720 }}>
            {/* Account Settings Section */}
            {activeSection === 'account' && (
              <>
                {/* Change Password */}
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

                {/* Change Email */}
                <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
                  <h4>{t('settings.change_email')}</h4>
                  <p>{t('settings.current_email')} <strong>{userData.email || '当前未绑定邮箱'}</strong></p>
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

                {/* Change Phone Number */}
                {userData.phone_number && (
                  <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
                    <h4>{t('settings.change_phone')}</h4>
                    <p>
                      {t('settings.current_phone')} <strong>
                        {userData.phone_number.substring(0, 3)}****{userData.phone_number.substring(7)}
                      </strong>
                    </p>
                    {!showPhoneForm ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <PrimaryButton onClick={startPhoneChange}>{t('settings.change_phone')}</PrimaryButton>
                      </div>
                    ) : (
                      <div>
                        {/* Progress Indicator */}
                        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                          {[1, 2, 3].map(step => (
                            <div key={step} style={{ 
                              flex: 1, 
                              height: 4, 
                              background: phoneChangeStep >= step ? '#736B92' : '#e9ecef',
                              borderRadius: 2,
                              transition: 'background 0.3s'
                            }} />
                          ))}
                        </div>

                        {/* Step 1: Verify Current Phone */}
                        {phoneChangeStep === 1 && (
                          <div>
                            <h5 style={{ marginBottom: 8, fontSize: '1rem' }}>{t('settings.phone_change_step1')}</h5>
                            <p style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: 16 }}>
                              {t('settings.phone_change_desc_step1')}
                            </p>
                            <div className="mb-3">
                              <label className="form-label">{t('settings.verification_code')}</label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  value={currentPhoneCode} 
                                  onChange={e => setCurrentPhoneCode(e.target.value)} 
                                  placeholder="请输入6位验证码"
                                  maxLength={6}
                                />
                                <PrimaryButton 
                                  onClick={sendCodeToCurrentPhone} 
                                  disabled={sendingCode || resendTimer > 0}
                                  style={{ minWidth: 120 }}
                                >
                                  {sendingCode ? t('settings.sending') : 
                                   resendTimer > 0 ? `${resendTimer}${t('settings.resend_in')}` : 
                                   t('settings.send_code')}
                                </PrimaryButton>
                              </div>
                            </div>
                            {phoneError && (
                              <div className="text-danger mb-2" style={{ fontSize: '0.95rem' }}>{phoneError}</div>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <PrimaryButton onClick={verifyCurrentPhone} disabled={verifyingCode || !currentPhoneCode}>
                                {verifyingCode ? t('settings.sending') : t('settings.next_step')}
                              </PrimaryButton>
                              <SecondaryButton onClick={cancelPhoneChange}>{t('common.cancel')}</SecondaryButton>
                            </div>
                          </div>
                        )}

                        {/* Step 2: Enter New Phone */}
                        {phoneChangeStep === 2 && (
                          <div>
                            <h5 style={{ marginBottom: 8, fontSize: '1rem' }}>{t('settings.phone_change_step2')}</h5>
                            <p style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: 16 }}>
                              {t('settings.phone_change_desc_step2')}
                            </p>
                            <div style={{ 
                              padding: 12, 
                              background: '#fff3cd', 
                              border: '1px solid #ffc107',
                              borderRadius: 8,
                              marginBottom: 16,
                              fontSize: '0.9rem'
                            }}>
                              {t('settings.phone_change_warning')}
                            </div>
                            <div className="mb-3">
                              <label className="form-label">{t('settings.new_phone')}</label>
                              <input 
                                type="tel" 
                                className="form-control" 
                                value={newPhoneNumber} 
                                onChange={e => setNewPhoneNumber(e.target.value)} 
                                placeholder="请输入11位手机号"
                                maxLength={11}
                              />
                            </div>
                            {phoneError && (
                              <div className="text-danger mb-2" style={{ fontSize: '0.95rem' }}>{phoneError}</div>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <PrimaryButton onClick={sendCodeToNewPhone} disabled={sendingCode || !newPhoneNumber}>
                                {sendingCode ? t('settings.sending') : t('settings.next_step')}
                              </PrimaryButton>
                              <SecondaryButton onClick={cancelPhoneChange}>{t('common.cancel')}</SecondaryButton>
                            </div>
                          </div>
                        )}

                        {/* Step 3: Verify New Phone */}
                        {phoneChangeStep === 3 && (
                          <div>
                            <h5 style={{ marginBottom: 8, fontSize: '1rem' }}>{t('settings.phone_change_step3')}</h5>
                            <p style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: 16 }}>
                              {t('settings.phone_change_desc_step3')}
                            </p>
                            <div className="mb-3">
                              <label className="form-label">{t('settings.verification_code')}</label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  value={newPhoneCode} 
                                  onChange={e => setNewPhoneCode(e.target.value)} 
                                  placeholder="请输入6位验证码"
                                  maxLength={6}
                                />
                                <PrimaryButton 
                                  onClick={sendCodeToNewPhone} 
                                  disabled={sendingCode || resendTimer > 0}
                                  style={{ minWidth: 120 }}
                                >
                                  {sendingCode ? t('settings.sending') : 
                                   resendTimer > 0 ? `${resendTimer}${t('settings.resend_in')}` : 
                                   t('settings.resend_code')}
                                </PrimaryButton>
                              </div>
                            </div>
                            {phoneError && (
                              <div className="text-danger mb-2" style={{ fontSize: '0.95rem' }}>{phoneError}</div>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <PrimaryButton onClick={confirmPhoneChange} disabled={verifyingCode || !newPhoneCode}>
                                {verifyingCode ? t('settings.sending') : t('settings.confirm_change')}
                              </PrimaryButton>
                              <SecondaryButton onClick={cancelPhoneChange}>{t('common.cancel')}</SecondaryButton>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {/* Delete Account - Danger Zone */}
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
              </>
            )}

            {/* Language Settings Section */}
            {activeSection === 'language' && (
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
            )}
          </div>
        </div>
      </div>
      <ConfirmModal show={confirmDelete.show} title={t('settings.delete_account')} message={t('settings.delete_account_confirm')} onCancel={() => setConfirmDelete({ show: false })} onConfirm={() => { setConfirmDelete({ show: false }); doDeleteAccount(); }} confirmText={t('common.delete')} cancelText={t('common.cancel')} />
    </PageWrapper>
  );
}
