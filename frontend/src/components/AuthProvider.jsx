import React, { createContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); // Added for database user data
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      if (user) {
        user.getIdToken().then((freshToken) => {
          setIdToken(freshToken);
          fetch('/api/users/me', {
            headers: {
              'Authorization': `Bearer ${freshToken}`
            }
          })
            .then(response => {
              if (response.ok) {
                return response.json();
              } else {
                console.error('Failed to fetch user data');
                return null;
              }
            })
            .then(data => {
              if (data) setUserData(data);
            })
            .catch(error => {
              console.error('Error fetching user data:', error);
            });
        });
      } else {
        setUserData(null);
        setIdToken(null);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      userData,    // Now includes database record
      idToken,
      loading,
      refreshUserData: async () => {  // Added refresh function
        if (currentUser) {
          try {
            const freshToken = await currentUser.getIdToken();
            const response = await fetch('/api/users/me', {
              headers: {
                'Authorization': `Bearer ${freshToken}`
              }
            });
            if (response.ok) {
              const data = await response.json();
              setUserData(data);
            }
          } catch (error) {
            console.error('Error refreshing user data:', error);
          }
        }
      }
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}