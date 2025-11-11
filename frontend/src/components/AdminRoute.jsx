import React, { useContext } from 'react';
import { Navigate } from 'react-router';
import { AuthContext } from './AuthProvider';

export default function AdminRoute({ children }) {
  const { userData, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh'
      }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Not logged in - redirect to welcome page
  if (!userData) {
    return <Navigate to="/" replace />;
  }

  // Logged in but not admin - redirect to home
  if (!userData.is_admin) {
    return <Navigate to="/" replace />;
  }

  // User is admin - allow access
  return children;
}
