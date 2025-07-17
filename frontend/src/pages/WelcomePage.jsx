import React, { useState} from 'react';
import { useNavigate } from 'react-router';
import { authReady, secureSignInWithEmailAndPassword, getAuthInstance } from '../firebase';

function WelcomePage({ setUser }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value.trim();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const userCredential = await secureSignInWithEmailAndPassword(email, password);
      const firebaseUser = userCredential.user;
      
      const idToken = await firebaseUser.getIdToken();
      
      const res = await fetch(`/api/verify-firebase-token`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to verify token with backend');
      }

      const userData = await res.json();
      setUser(userData.user);

    } catch (error) {
      console.error("Login error:", error);
      setError(error.message.replace('Firebase: ', ''));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container d-flex flex-column justify-content-center align-items-center text-center vh-100">
      <h1 className="mb-4">Welcome to Character Library</h1>
      <p className="mb-4">Discover and chat with your favorite characters.</p>
      {error && <div className="alert alert-danger mb-3">{error}</div>}
      <form onSubmit={handleLogin} className="w-100" style={{ maxWidth: 400 }}>
        <div className="mb-3">
          <input name="email" type="email" className="form-control" placeholder="Email" required />
        </div>
        <div className="mb-3">
          <input name="password" type="password" className="form-control" placeholder="Password" required />
        </div>
        <div className="d-grid gap-2">
          <button 
            type="submit" 
            className="btn btn-dark"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/account-setup')}>Sign up</button>
        </div>
      </form>
    </div>
  );
}

export default WelcomePage;