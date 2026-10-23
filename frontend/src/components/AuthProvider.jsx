

import React, { createContext, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../utils/apiErrorUtils';


export const AuthContext = createContext();

/**
 * Generate a lightweight, stable device fingerprint from browser environment signals.
 * This is intentionally simple — it is only used as a soft signal to help admins
 * spot possibly linked accounts, not as a security control.
 */
function getDeviceFingerprint() {
  try {
    const raw = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      String(screen.width),
      String(screen.height),
      String(screen.colorDepth),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join('|');
    // Simple non-cryptographic hash (djb2)
    let hash = 5381;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  } catch {
    return null;
  }
}


export function AuthProvider({ children, initialState = null }) {
  const [sessionToken, setSessionToken] = useState(() => {
    if (initialState) return initialState.sessionToken;
    try {
      return typeof window === 'undefined' ? null : localStorage.getItem('sessionToken');
    } catch {
      return null;
    }
  });
  const [userData, setUserData] = useState(initialState?.userData ?? null);
  const [loading, setLoading] = useState(initialState?.loading ?? true);
  const [error, setError] = useState(null);
  const { t } = useTranslation();

  // Fetch user data using session token
  const fetchUserData = useCallback(async ({ silent = false } = {}) => {
    if (!sessionToken) {
      setUserData(null);
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/users/me`, {
        headers: {
          'Authorization': sessionToken
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      } else {
        setUserData(null);
        setError('Failed to fetch user data');
      }
    } catch (err) {
      setUserData(null);
      setError('Error fetching user data');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [sessionToken]);

  // Login function
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(getDeviceFingerprint() ? { 'X-Device-Fingerprint': getDeviceFingerprint() } : {}),
        },
        body: new URLSearchParams({ email, password })
      });
      const result = await response.json();
      if (response.ok && result.token) {
        setSessionToken(result.token);
        localStorage.setItem('sessionToken', result.token);
        setUserData(result.user);
        setError(null);
        return true;
      } else {
        setError(result.detail || 'Login failed');
        setUserData(null);
        setSessionToken(null);
        localStorage.removeItem('sessionToken');
        return false;
      }
    } catch (err) {
      setError('Login error');
      setUserData(null);
      setSessionToken(null);
      localStorage.removeItem('sessionToken');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Registration function
  const register = async (email, name, password, bio, profileFile = null, invitationCode = null) => {
    setLoading(true);
    setError(null);
    try {
      let response;
      const fp = getDeviceFingerprint();
      const fpHeader = fp ? { 'X-Device-Fingerprint': fp } : {};
      if (profileFile) {
        const formData = new FormData();
        formData.append('email', email);
        formData.append('name', name);
        formData.append('password', password);
        formData.append('invitation_code', invitationCode);
        if (bio) formData.append('bio', bio);
        formData.append('profile_pic', profileFile);
        response = await fetch(`${window.API_BASE_URL}/api/users`, {
          method: 'POST',
          headers: { ...fpHeader },
          body: formData
        });
      } else {
        response = await fetch(`${window.API_BASE_URL}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...fpHeader },
          body: new URLSearchParams({ email, name, password, invitation_code: invitationCode, bio })
        });
      }
      const result = await response.json();
      if (response.ok && result.token) {
        setSessionToken(result.token);
        localStorage.setItem('sessionToken', result.token);
        setUserData(result.user);
        setError(null);
        return true;
      } else {
        setError(getApiErrorMessage(result, 'Registration failed', t));
        setUserData(null);
        setSessionToken(null);
        localStorage.removeItem('sessionToken');
        return false;
      }
    } catch (err) {
      setError('Registration error');
      setUserData(null);
      setSessionToken(null);
      localStorage.removeItem('sessionToken');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    setSessionToken(null);
    setUserData(null);
    localStorage.removeItem('sessionToken');
  };

  // Send SMS verification code
  const sendVerificationCode = async (phoneNumber) => {
    // Don't use setLoading to avoid full-page overlay
    setError(null);
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ phone_number: phoneNumber })
      });
      const result = await response.json();
      if (response.ok) {
        setError(null);
        return { success: true, message: result.message, code: result.verify_code };
      } else {
        setError(result.detail || 'Failed to send verification code');
        return { success: false, message: result.detail };
      }
    } catch (err) {
      setError('Error sending verification code');
      return { success: false, message: 'Network error' };
    }
  };

  // Verify phone number with code
  const verifyPhone = async (phoneNumber, code, captchaVerifyParam = null, termsAccepted = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = { phone_number: phoneNumber, verification_code: code };
      if (captchaVerifyParam) {
        params.captcha_verify_param = captchaVerifyParam;
      }
      params.terms_accepted = String(termsAccepted);
      const response = await fetch(`${window.API_BASE_URL}/api/verify-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params)
      });
      const result = await response.json();
      if (response.ok) {
        if (result.status === 'existing_user' || result.status === 'new_user') {
          setSessionToken(result.session_token);
          localStorage.setItem('sessionToken', result.session_token);
          setUserData(result.user);
          setError(null);
          return { success: true, status: result.status };
        }
        setError('Unexpected phone verification response');
        return { success: false, message: 'Unexpected phone verification response' };
      } else {
        setError(result.detail || 'Verification failed');
        return { success: false, message: result.detail };
      }
    } catch (err) {
      setError('Verification error');
      return { success: false, message: 'Network error' };
    } finally {
      setLoading(false);
    }
  };

  // Fetch user data on mount or when sessionToken changes
  useEffect(() => {
    if (initialState) {
      let storedToken = null;
      try {
        storedToken = localStorage.getItem('sessionToken');
      } catch {
        storedToken = null;
      }
      if (storedToken !== sessionToken) {
        setSessionToken(storedToken);
        return;
      }
    }
    fetchUserData({ silent: Boolean(initialState && sessionToken) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  useEffect(() => {
    const resetAt = Date.parse(userData?.next_free_daily_reset_at || '');
    if (!sessionToken || !Number.isFinite(resetAt)) return undefined;

    const refreshAfterReset = () => {
      if (Date.now() >= resetAt) {
        fetchUserData({ silent: true });
      }
    };
    const timeoutId = window.setTimeout(
      refreshAfterReset,
      Math.max(0, resetAt - Date.now()) + 1000
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshAfterReset();
    };

    window.addEventListener('focus', refreshAfterReset);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('focus', refreshAfterReset);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchUserData, sessionToken, userData?.next_free_daily_reset_at]);

  return (
    <AuthContext.Provider value={{
      userData,
      setUserData,
      sessionToken,
      loading,
      error,
      login,
      register,
      logout,
      sendVerificationCode,
      verifyPhone,
      refreshUserData: fetchUserData
    }}>
      {children}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(255,255,255,0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner-border text-primary" role="status" style={{ width: 48, height: 48 }}>
              <span className="visually-hidden">{t('auth_provider.loading')}</span>
            </div>
            <div style={{ marginTop: 16, color: '#222', fontWeight: 500 }}>{t('auth_provider.loading_user_session')}</div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}