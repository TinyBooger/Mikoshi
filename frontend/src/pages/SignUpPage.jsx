import React, { useState } from 'react';
import { useNavigate } from 'react-router';
  // Go Back handler
  const handleGoBack = () => {
    window.history.length > 1 ? window.history.back() : navigate('/');
  };
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import PageWrapper from '../components/PageWrapper';

export default function SignUpPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      // 1. Create user with email and password in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // 2. Update profile with display name in Firebase Auth
      await updateProfile(userCredential.user, {
        displayName: name
      });

      // 3. Get Firebase ID token for backend verification
      const idToken = await userCredential.user.getIdToken();

      // 4. Create user record in your database
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          name: name,
          email: email,
          bio: bio // include bio
          // Include other fields if needed
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create user record');
      }

      // 5. Navigate to home page after successful signup
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      // Optional: Delete the Firebase user if database creation fails
      if (auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (deleteError) {
          console.error("Error cleaning up Firebase user:", deleteError);
        }
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleGoBack}
        style={{ position: 'absolute', top: 24, left: 24, zIndex: 1000, background: 'none', border: 'none', color: '#222', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        aria-label="Go back"
      >
        <span style={{ fontSize: '1.5rem', marginRight: 6 }}>&larr;</span> Back
      </button>
      <PageWrapper>
        <div className="container">
          <div className="mx-auto" style={{ maxWidth: 400 }}>
            <h2 className="mb-4 text-center fw-bold py-4" style={{ fontWeight: 700, paddingTop: '2rem', paddingBottom: '2rem' }}>Sign Up</h2>
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

              <div className="mb-3">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength="6"
                  autoComplete="new-password"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Short Bio <span className="text-muted" style={{ fontWeight: 400, fontSize: '0.9em' }}>(optional)</span></label>
                <textarea
                  className="form-control"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder="Tell us a little about yourself (max 200 chars)"
                />
              </div>

              <button type="submit" className="btn btn-dark w-100">Submit</button>
            </form>
          </div>
        </div>
      </PageWrapper>
    </>
  );
}