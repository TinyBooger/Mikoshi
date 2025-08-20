
import React, { createContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper to fetch user data and idToken, with retry logic and debug logging
  const fetchUserData = async (user, attempt = 1) => {
    setUserDataLoading(true);
    setError(null);
    try {
      const freshToken = await user.getIdToken();
      setIdToken(freshToken);
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${freshToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      } else {
        setUserData(null);
        setError('Failed to fetch user data');
        console.error('[AuthProvider] Failed to fetch user data, status:', response.status);
        // Retry up to 3 times with delay
        if (attempt < 3) {
          setTimeout(() => fetchUserData(user, attempt + 1), 1000 * attempt);
        }
      }
    } catch (err) {
      setUserData(null);
      setIdToken(null);
      setError('Error fetching user data');
      console.error('[AuthProvider] Error fetching user data:', err);
      // Retry up to 3 times with delay
      if (attempt < 3) {
        setTimeout(() => fetchUserData(user, attempt + 1), 1000 * attempt);
      }
    } finally {
      setUserDataLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (!user) {
        setUserData(null);
        setIdToken(null);
        setUserDataLoading(false);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Delay fetchUserData until authLoading is false and currentUser is available
  useEffect(() => {
    if (!authLoading && currentUser) {
      fetchUserData(currentUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentUser]);

  // Combined loading state
  const loading = authLoading || (currentUser && userDataLoading);

  return (
    <AuthContext.Provider value={{
      currentUser,
      userData,
      idToken,
      loading,
      error,
      refreshUserData: async () => {
        if (currentUser) {
          await fetchUserData(currentUser);
        }
      }
    }}>
      {/* Always render children, but show a loading spinner overlay if loading */}
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
              <span className="visually-hidden">Loading...</span>
            </div>
            <div style={{ marginTop: 16, color: '#222', fontWeight: 500 }}>Loading user session...</div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}