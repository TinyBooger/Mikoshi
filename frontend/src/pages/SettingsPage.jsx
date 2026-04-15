import React, { useContext, useState } from 'react';
import OrderHistoryTab from './OrderHistoryTab.jsx';
import PageWrapper from '../components/PageWrapper';
import { AuthContext } from '../components/AuthProvider';
import { useToast } from '../components/ToastProvider';
import ConfirmModal from '../components/ConfirmModal';
import { useTranslation } from 'react-i18next';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import ProblemReportModal from '../components/ProblemReportModal';

function HelpFaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid #f0eef7', marginBottom: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          textAlign: 'left',
          padding: '12px 4px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 600,
          color: '#3d3558',
          fontSize: '0.97rem'
        }}
      >
        {question}
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ color: '#736B92', flexShrink: 0, marginLeft: 8 }}></i>
      </button>
      {open && (
        <div style={{ padding: '0 4px 12px 4px', color: '#6c757d', fontSize: '0.92rem', lineHeight: 1.6 }}>
          {answer}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { userData, sessionToken, refreshUserData, logout } = useContext(AuthContext);
  const toast = useToast();
  const { t, i18n } = useTranslation();

  const [activeSection, setActiveSection] = useState('account');
  const [activeTab, setActiveTab] = useState('account');

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
  const [lang, setLang] = useState('zh');
  const [showProblemReport, setShowProblemReport] = useState(false);

  // Set default language to Chinese
  React.useEffect(() => {
    if (i18n.language !== 'zh') {
      i18n.changeLanguage('zh');
      setLang('zh');
    }
  }, [i18n]);
  if (!userData) return null;

  const handleLangToggle = (newLang) => {
    i18n.changeLanguage(newLang);
    setLang(newLang);
    toast.show('语言已切换到中文', { type: 'info' });
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
        <h2>设置</h2>
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
                onClick={() => setActiveSection('orderHistory')}
                style={{
                  padding: '12px 16px',
                  border: 'none',
                  background: activeSection === 'orderHistory' ? '#f0eef7' : 'transparent',
                  color: activeSection === 'orderHistory' ? '#736B92' : '#6c757d',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: activeSection === 'orderHistory' ? 600 : 400,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== 'orderHistory') {
                    e.currentTarget.style.background = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== 'orderHistory') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                订单历史
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
              <button
                onClick={() => setActiveSection('help')}
                style={{
                  padding: '12px 16px',
                  border: 'none',
                  background: activeSection === 'help' ? '#f0eef7' : 'transparent',
                  color: activeSection === 'help' ? '#736B92' : '#6c757d',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: activeSection === 'help' ? 600 : 400,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== 'help') {
                    e.currentTarget.style.background = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== 'help') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                帮助
              </button>
            </nav>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, maxWidth: 1100, minWidth: 0 }}>
            {/* Account Settings Section */}
            {activeSection === 'account' && (
              <>
                {/* Change Password */}
                <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
                  <h4>安全设置</h4>
                  {!showPasswordForm ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <PrimaryButton onClick={() => setShowPasswordForm(true)}>修改密码</PrimaryButton>
                    </div>
                  ) : (
                    <form onSubmit={doChangePassword}>
                      <div className="mb-2">
                        <label className="form-label">当前密码</label>
                        <input type="password" className="form-control" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                      </div>
                      <div className="mb-2">
                        <label className="form-label">新密码</label>
                        <input type="password" className="form-control" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                      </div>
                      <div className="mb-2">
                        <label className="form-label">确认新密码</label>
                        <input type="password" className="form-control" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required />
                      </div>
                      {passwordError && (
                        <div className="text-danger mb-2" style={{ fontSize: '0.95rem' }}>{passwordError}</div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <PrimaryButton type="submit" disabled={changingPassword}>修改密码</PrimaryButton>
                        <SecondaryButton type="button" onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); }}>取消</SecondaryButton>
                      </div>
                    </form>
                  )}
                </section>

                {/* Change Email */}
                <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
                  <h4>修改邮箱</h4>
                  <p>当前邮箱 <strong>{userData.email || '当前未绑定邮箱'}</strong></p>
                  {!showEmailForm ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <PrimaryButton onClick={() => setShowEmailForm(true)}>修改邮箱</PrimaryButton>
                    </div>
                  ) : (
                    <form onSubmit={doChangeEmail}>
                      <div className="mb-2">
                        <label className="form-label">新邮箱</label>
                        <input type="email" className="form-control" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <PrimaryButton type="submit" disabled={changingEmail}>修改邮箱</PrimaryButton>
                        <SecondaryButton type="button" onClick={() => { setShowEmailForm(false); setNewEmail(''); setEmailError(''); }}>取消</SecondaryButton>
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
                    <h4>修改手机号</h4>
                    <p>
                      当前手机号 <strong>
                        {userData.phone_number.substring(0, 3)}****{userData.phone_number.substring(7)}
                      </strong>
                    </p>
                    {!showPhoneForm ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <PrimaryButton onClick={startPhoneChange}>修改手机号</PrimaryButton>
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
                            <h5 style={{ marginBottom: 8, fontSize: '1rem' }}>第一步：验证当前手机号</h5>
                            <p style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: 16 }}>
                              我们将向您当前绑定的手机号发送验证码，请输入收到的验证码。
                            </p>
                            <div className="mb-3">
                              <label className="form-label">验证码</label>
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
                                  {sendingCode ? '发送中...' : 
                                   resendTimer > 0 ? `${resendTimer}秒后可重发` : 
                                   '发送验证码'}
                                </PrimaryButton>
                              </div>
                            </div>
                            {phoneError && (
                              <div className="text-danger mb-2" style={{ fontSize: '0.95rem' }}>{phoneError}</div>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <PrimaryButton onClick={verifyCurrentPhone} disabled={verifyingCode || !currentPhoneCode}>
                                {verifyingCode ? '发送中...' : '下一步'}
                              </PrimaryButton>
                              <SecondaryButton onClick={cancelPhoneChange}>取消</SecondaryButton>
                            </div>
                          </div>
                        )}

                        {/* Step 2: Enter New Phone */}
                        {phoneChangeStep === 2 && (
                          <div>
                            <h5 style={{ marginBottom: 8, fontSize: '1rem' }}>第二步：输入新手机号</h5>
                            <p style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: 16 }}>
                              请输入您要绑定的新手机号。
                            </p>
                            <div style={{ 
                              padding: 12, 
                              background: '#fff3cd', 
                              border: '1px solid #ffc107',
                              borderRadius: 8,
                              marginBottom: 16,
                              fontSize: '0.9rem'
                            }}>
                              更换手机号后，原手机号将无法用于登录。
                            </div>
                            <div className="mb-3">
                              <label className="form-label">新手机号</label>
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
                                {sendingCode ? '发送中...' : '下一步'}
                              </PrimaryButton>
                              <SecondaryButton onClick={cancelPhoneChange}>取消</SecondaryButton>
                            </div>
                          </div>
                        )}

                        {/* Step 3: Verify New Phone */}
                        {phoneChangeStep === 3 && (
                          <div>
                            <h5 style={{ marginBottom: 8, fontSize: '1rem' }}>第三步：验证新手机号</h5>
                            <p style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: 16 }}>
                              我们将向新手机号发送验证码，请输入收到的验证码完成更换。
                            </p>
                            <div className="mb-3">
                              <label className="form-label">验证码</label>
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
                                  {sendingCode ? '发送中...' : 
                                   resendTimer > 0 ? `${resendTimer}秒后可重发` : 
                                   '重新发送验证码'}
                                </PrimaryButton>
                              </div>
                            </div>
                            {phoneError && (
                              <div className="text-danger mb-2" style={{ fontSize: '0.95rem' }}>{phoneError}</div>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <PrimaryButton onClick={confirmPhoneChange} disabled={verifyingCode || !newPhoneCode}>
                                {verifyingCode ? '发送中...' : '确认更换'}
                              </PrimaryButton>
                              <SecondaryButton onClick={cancelPhoneChange}>取消</SecondaryButton>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {/* Delete Account - Danger Zone */}
                <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
                  <h4 className="text-danger">危险操作</h4>
                  <p className="text-muted">此操作将永久删除您的账号，数据无法恢复。请谨慎操作！</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <PrimaryButton 
                      onClick={() => setConfirmDelete({ show: true })}
                      style={{ background: '#d32f2f', color: '#fff' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#b71c1c'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#d32f2f'; }}
                    >
                      删除账号
                    </PrimaryButton>
                  </div>
                </section>
              </>
            )}

            {/* Order History Tab */}
            {activeSection === 'orderHistory' && (
              <OrderHistoryTab />
            )}

            {/* Help / Support Section */}
            {activeSection === 'help' && (
              <>
                {/* FAQ */}
                <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
                  <h4>常见问题</h4>

                  {[
                    {
                      q: '如何修改密码？',
                      a: '前往「设置 → 账号 → 安全设置」，点击「修改密码」按钮，按照提示输入当前密码和新密码即可完成修改。'
                    },
                    {
                      q: '如何修改邮箱或手机号？',
                      a: '前往「设置 → 账号」，找到「修改邮箱」或「修改手机号」区域进行操作。'
                    },
                    {
                      q: '忘记密码怎么办？',
                      a: '在登录页面点击「忘记密码」，通过绑定的邮箱或手机号验证身份后即可重置密码。'
                    },
                    {
                      q: 'Token 余额不足怎么办？',
                      a: '前往「充值」页面购买 Token，或升级为专业版（Pro）用户以获得更多额度。'
                    },
                    {
                      q: '订单支付遇到问题怎么办？',
                      a: '请先确认支付是否已从账户扣款。若已扣款但余额未到账，可在下方提交问题报告，并附上截图，我们会尽快处理。'
                    },
                    {
                      q: '如何申请退款？',
                      a: '请在「设置 → 订单历史」中找到对应订单，查看退款政策并提交退款申请；或通过下方的「提交问题」联系我们。'
                    },
                    {
                      q: '如何删除账号？',
                      a: '前往「设置 → 账号 → 危险操作」，点击「删除账号」。请注意，此操作不可逆，账号及相关数据将被永久删除。'
                    },
                  ].map(({ q, a }, i) => (
                    <HelpFaqItem key={i} question={q} answer={a} />
                  ))}
                </section>

                {/* Problem Report */}
                <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
                  <h4>提交问题</h4>
                  <p className="text-muted" style={{ marginBottom: 12 }}>
                    遇到其他问题？请向我们提交详细描述，方便我们更快地帮助您。
                  </p>
                  <PrimaryButton onClick={() => setShowProblemReport(true)}>
                    <i className="bi bi-send me-2"></i>提交问题报告
                  </PrimaryButton>
                </section>
              </>
            )}

            {/* Language Settings Section */}
            {activeSection === 'language' && (
              <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16 }}>
                <h4>语言</h4>
                <p>当前语言: <strong>中文</strong></p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
      <ConfirmModal show={confirmDelete.show} title="删除账号" message="此操作将永久删除您的账号，数据无法恢复。请谨慎操作！" onCancel={() => setConfirmDelete({ show: false })} onConfirm={() => { setConfirmDelete({ show: false }); doDeleteAccount(); }} confirmText="删除" cancelText="取消" />
      <ProblemReportModal show={showProblemReport} onClose={() => setShowProblemReport(false)} />
    </PageWrapper>
  );
}
