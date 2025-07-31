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

  // Helper to fetch user data and idToken
  const fetchUserData = async (user) => {
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
      }
    } catch (err) {
      setUserData(null);
      setIdToken(null);
      setError('Error fetching user data');
    } finally {
      setUserDataLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchUserData(user);
      } else {
        setUserData(null);
        setIdToken(null);
        setUserDataLoading(false);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {!loading && children}
    </AuthContext.Provider>
  );
}