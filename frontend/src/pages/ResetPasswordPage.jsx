import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import PrimaryButton from '../components/PrimaryButton';
import TextButton from '../components/TextButton';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // 选项卡：'phone' 或 'email'
  const [activeTab, setActiveTab] = useState('phone');
  
  // 手机号找回状态
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneVerifyCode, setPhoneVerifyCode] = useState('');
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const [phoneDevCode, setPhoneDevCode] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneResetToken, setPhoneResetToken] = useState('');
  
  // 邮箱找回状态
  const [email, setEmail] = useState('');
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailResetToken, setEmailResetToken] = useState('');
  
  // 共享状态
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // 倒计时效果
  useEffect(() => {
    if (phoneCountdown > 0) {
      const timer = setTimeout(() => setPhoneCountdown(phoneCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneCountdown]);

  useEffect(() => {
    if (emailCountdown > 0) {
      const timer = setTimeout(() => setEmailCountdown(emailCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailCountdown]);

  // 发送手机验证码
  const handleSendPhoneCode = async (e) => {
    e.preventDefault();
    if (!phoneNumber || phoneCountdown > 0) return;
    
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/send-reset-code-phone`, {
        method: 'POST',
        body: new URLSearchParams({ phone_number: phoneNumber }),
      });
      const result = await response.json();
      
      if (response.ok && result.success) {
        setPhoneCountdown(60);
        if (result.code) setPhoneDevCode(result.code);
        setError('');
      } else {
        setError(result.message || result.detail || '发送失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 验证手机号验证码
  const handleVerifyPhone = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/verify-reset-code-phone`, {
        method: 'POST',
        body: new URLSearchParams({
          phone_number: phoneNumber,
          code: phoneVerifyCode
        }),
      });
      const result = await response.json();
      
      if (response.ok && result.success) {
        setPhoneVerified(true);
        setPhoneResetToken(result.reset_token);
        setError('');
      } else {
        setError(result.message || result.detail || '验证码错误');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 发送邮箱验证码
  const handleSendEmailCode = async (e) => {
    e.preventDefault();
    if (!email || emailCountdown > 0) return;
    
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/send-reset-code-email`, {
        method: 'POST',
        body: new URLSearchParams({ email }),
      });
      const result = await response.json();
      
      if (response.ok && result.success) {
        setEmailCountdown(60);
        setError('');
      } else {
        setError(result.message || result.detail || '发送失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 验证邮箱验证码
  const handleVerifyEmail = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/verify-reset-code-email`, {
        method: 'POST',
        body: new URLSearchParams({
          email,
          code: emailVerifyCode
        }),
      });
      const result = await response.json();
      
      if (response.ok && result.success) {
        setEmailVerified(true);
        setEmailResetToken(result.reset_token);
        setError('');
      } else {
        setError(result.message || result.detail || '验证码错误');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 重置密码
  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('密码至少需要6位');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const resetToken = activeTab === 'phone' ? phoneResetToken : emailResetToken;
      const response = await fetch(`${window.API_BASE_URL}/api/reset-password-with-token`, {
        method: 'POST',
        body: new URLSearchParams({
          reset_token: resetToken,
          new_password: newPassword
        }),
      });
      const result = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/welcome'), 2000);
      } else {
        setError(result.message || result.detail || '重置失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const isVerified = activeTab === 'phone' ? phoneVerified : emailVerified;

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <div className="mx-auto" style={{ maxWidth: 450, width: '100%' }}>
        <TextButton
          onClick={() => navigate(-1)}
          style={{ marginBottom: '1rem' }}
        >
          <span style={{ fontSize: '1.5rem', marginRight: 6 }}>&larr;</span> 返回
        </TextButton>
        
        <h2 className="mb-4 text-center fw-bold">找回密码</h2>
        
        {!isVerified ? (
          <>
            {/* 选项卡 */}
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
                手机号找回
              </button>
              <button
                type="button"
                className="flex-grow-1 py-2"
                style={{
                  border: 'none',
                  background: 'none',
                  fontWeight: activeTab === 'email' ? 600 : 400,
                  color: activeTab === 'email' ? '#0d6efd' : '#adb5bd',
                  borderBottom: activeTab === 'email' ? '3px solid #0d6efd' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '1rem',
                  paddingBottom: '0.5rem'
                }}
                onClick={() => setActiveTab('email')}
              >
                邮箱找回
              </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {activeTab === 'phone' ? (
              <div>
                <div className="mb-3">
                  <label className="form-label">手机号</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="请输入绑定的手机号"
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
                      value={phoneVerifyCode}
                      onChange={(e) => setPhoneVerifyCode(e.target.value)}
                      required
                      maxLength={6}
                    />
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={handleSendPhoneCode}
                      disabled={phoneCountdown > 0 || !phoneNumber || loading}
                    >
                      {phoneCountdown > 0 ? `${phoneCountdown}秒后重试` : '获取验证码'}
                    </button>
                  </div>
                  {phoneDevCode && (
                    <small className="text-muted">开发环境验证码：{phoneDevCode}</small>
                  )}
                </div>
                <PrimaryButton
                  onClick={handleVerifyPhone}
                  className="w-100"
                  disabled={!phoneNumber || !phoneVerifyCode || loading}
                >
                  {loading ? '验证中...' : '验证'}
                </PrimaryButton>
              </div>
            ) : (
              <div>
                <div className="mb-3">
                  <label className="form-label">邮箱</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="请输入绑定的邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">验证码</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="请输入验证码"
                      value={emailVerifyCode}
                      onChange={(e) => setEmailVerifyCode(e.target.value)}
                      required
                      maxLength={6}
                    />
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={handleSendEmailCode}
                      disabled={emailCountdown > 0 || !email || loading}
                    >
                      {emailCountdown > 0 ? `${emailCountdown}秒后重试` : '获取验证码'}
                    </button>
                  </div>
                </div>
                <PrimaryButton
                  onClick={handleVerifyEmail}
                  className="w-100"
                  disabled={!email || !emailVerifyCode || loading}
                >
                  {loading ? '验证中...' : '验证'}
                </PrimaryButton>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleResetPassword}>
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">密码重置成功！即将跳转到登录页...</div>}
            
            <div className="alert alert-success mb-3">
              ✓ 身份验证成功，请设置新密码
            </div>
            
            <div className="mb-3">
              <label className="form-label">新密码</label>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="至少6位"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">确认新密码</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <PrimaryButton type="submit" className="w-100" disabled={loading || success}>
              {loading ? '重置中...' : '重置密码'}
            </PrimaryButton>
          </form>
        )}
      </div>
    </div>
  );
}
