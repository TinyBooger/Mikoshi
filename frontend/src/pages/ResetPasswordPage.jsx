import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/reset-password`, {
        method: 'POST',
        body: new URLSearchParams({ email, new_password: newPassword }),
      });
      const result = await response.json();
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/'), 2000);
      } else {
        setError(result.detail || result.message || t('reset_password.failed'));
      }
    } catch (err) {
      setError(t('common.network_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 400, margin: '60px auto' }}>
      <h2 className="mb-4">{t('reset_password.title')}</h2>
      <form onSubmit={handleSubmit} className="card p-4 shadow-sm">
        <div className="mb-3">
          <label className="form-label">{t('reset_password.email')}</label>
          <input
            type="email"
            className="form-control"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">{t('reset_password.new_password')}</label>
          <input
            type="password"
            className="form-control"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{t('reset_password.success')}</div>}
        <button type="submit" className="btn btn-primary w-100" disabled={loading}>
          {loading ? t('reset_password.resetting') : t('reset_password.submit')}
        </button>
      </form>
    </div>
  );
}
