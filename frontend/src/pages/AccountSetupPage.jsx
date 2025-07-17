import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { auth, createUserWithEmailAndPassword } from '../firebase';

export default function AccountSetupPage({ setUser }) {
  const MAX_NAME_LENGTH = 50;
  const MAX_EMAIL_LENGTH = 100;
  const MAX_PASSWORD_LENGTH = 100;

  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // 2. Prepare form data for our backend
      const formData = new FormData();
      formData.append("firebase_uid", firebaseUser.uid);
      formData.append("email", email.trim());
      formData.append("name", name.trim());
      
      if (e.target.profile_pic.files[0]) {
        formData.append("profile_pic", e.target.profile_pic.files[0]);
      }

      // 3. Create user in our database
      const res = await fetch('/api/account-setup', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        // If backend fails, delete the Firebase user to keep things clean
        await firebaseUser.delete();
        throw new Error(data.message || 'Failed to create account');
      }

      // 4. Get the Firebase ID token
      const idToken = await firebaseUser.getIdToken();
      
      // 5. Verify token with backend and get complete user data
      const verifyRes = await fetch('/api/verify-firebase-token', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      const userData = await verifyRes.json();

      if (!verifyRes.ok) {
        throw new Error('Failed to verify user session');
      }

      // 6. Set user in app state
      setUser(userData.user);
      navigate('/');

    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="bg-light d-flex align-items-center justify-content-center"
      style={{ minHeight: '100vh' }}
    >
      <div className="container">
        <div className="mx-auto" style={{ maxWidth: 400 }}>
          <h2 className="mb-4 text-center">Set Up Your Account</h2>
          
          {error && (
            <div className="alert alert-danger mb-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} encType="multipart/form-data">
            
            <div className="mb-3 position-relative">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                className="form-control"
                required
                value={email}
                maxLength={MAX_EMAIL_LENGTH}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingRight: "3rem" }}
              />
              <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
                {email.length}/{MAX_EMAIL_LENGTH}
              </small>
            </div>

            <div className="mb-3 position-relative">
              <label className="form-label">Password</label>
              <input
                type="password"
                name="password"
                className="form-control"
                required
                value={password}
                maxLength={MAX_PASSWORD_LENGTH}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: "3rem" }}
              />
              <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
                {password.length}/{MAX_PASSWORD_LENGTH}
              </small>
            </div>

            <div className="mb-3 position-relative">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-control"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="mb-3 position-relative">
              <label className="form-label">Name</label>
              <input
                type="text"
                name="name"
                className="form-control"
                required
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setName(e.target.value)}
                style={{ paddingRight: "3rem" }}
              />
              <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
                {name.length}/{MAX_NAME_LENGTH}
              </small>
            </div>

            <div className="mb-3">
              <label className="form-label">Profile Picture</label>
              <input type="file" name="profile_pic" className="form-control" accept="image/*" />
            </div>

            <button 
              type="submit" 
              className="btn btn-dark w-100"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}