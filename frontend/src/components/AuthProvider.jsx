

import React, { createContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';


export const AuthContext = createContext();


export function AuthProvider({ children }) {
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('sessionToken'));
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { t } = useTranslation();

  // Fetch user data using session token
  const fetchUserData = async ({ silent = false } = {}) => {
    if (!sessionToken) {
      setUserData(null);
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
  };

  // Login function
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
          body: formData
        });
      } else {
        response = await fetch(`${window.API_BASE_URL}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
        setError(result.detail || 'Registration failed');
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

  // Fetch user data on mount or when sessionToken changes
  useEffect(() => {
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

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