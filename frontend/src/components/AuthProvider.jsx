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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Get the Firebase ID token
          const freshToken = await user.getIdToken();
          setIdToken(freshToken);
          // Fetch user data from your backend
          const response = await fetch('/api/users/me', {
            headers: {
              'Authorization': `Bearer ${freshToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            setUserData(data); // Set the database user data
          } else {
            console.error('Failed to fetch user data');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUserData(null); // Clear user data when logged out
      }
      
      setCurrentUser(user);
      setLoading(false);
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