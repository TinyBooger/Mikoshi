import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';

export default function AccountSetupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update user profile with display name
      await updateProfile(userCredential.user, {
        displayName: name
      });

      // Navigate to home page after successful signup
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-light d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="container">
        <div className="mx-auto" style={{ maxWidth: 400 }}>
          <h2 className="mb-4 text-center">Set Up Your Account</h2>
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-control"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength="6"
              />
            </div>

            <button type="submit" className="btn btn-dark w-100">Submit</button>
          </form>
        </div>
      </div>
    </div>
  );
}