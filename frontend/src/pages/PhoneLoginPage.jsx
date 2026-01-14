import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../components/AuthProvider';
import { useTranslation } from 'react-i18next';
import PrimaryButton from '../components/ButtonRounded';
import CardSection from '../components/CardSection';

export default function PhoneLoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { verifyPhone, sendVerificationCode, loading, error } = useContext(AuthContext);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState('');

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!phoneNumber || countdown > 0) return;
    
    const result = await sendVerificationCode(phoneNumber);
    if (result.success) {
      setCountdown(60);
      if (result.code) {
        setDevCode(result.code);
      }
      alert(result.message || '验证码已发送');
    } else {
      alert(result.message || '发送失败');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    const result = await verifyPhone(phoneNumber, verificationCode);
    
    if (result.success) {
      if (result.status === 'existing_user') {
        // 老用户，直接登录成功
        navigate('/');
      } else if (result.status === 'new_user') {
        // 新用户，跳转到注册页面并携带验证token
        navigate(`/sign-up?phone_token=${result.verifiedPhoneToken}&phone=${result.phoneNumber}`);
      }
    } else {
      alert(result.message || '验证失败');
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <CardSection>
            <h2 className="text-center mb-4">手机号登录</h2>
            
            <form onSubmit={handleLogin}>
              {/* 手机号输入 */}
              <div className="mb-3">
                <label className="form-label">手机号</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="请输入手机号"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  pattern="^1[3-9]\d{9}$"
                />
              </div>

              {/* 验证码输入 */}
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

              {error && <div className="alert alert-danger">{error}</div>}

              <PrimaryButton type="submit" className="w-100" disabled={loading}>
                {loading ? '处理中...' : '登录'}
              </PrimaryButton>
            </form>

            <div className="text-center mt-3">
              <a href="/login" className="text-muted">使用邮箱密码登录</a>
            </div>
          </CardSection>
        </div>
      </div>
    </div>
  );
}
