// src/pages/WelcomePage.jsx
import React from 'react';
import { useNavigate } from 'react-router';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

function WelcomePage({ setUser }) {
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value.trim();

    const res = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    const data = await res.json();
    alert(data.message || data.detail);

    if (res.ok) {
      console.log("Fetching user...");
      const userRes = await fetch(`${API_BASE}/api/current-user`, { credentials: 'include' });
      const userData = await userRes.json();
      console.log("User data:", userData);
      setUser(userData); // ✅ this triggers App to re-render with logged-in router
    }
  };

  return (
    <div className="container d-flex flex-column justify-content-center align-items-center text-center vh-100">
      <h1 className="mb-4">Welcome to Character Library</h1>
      <p className="mb-4">Discover and chat with your favorite characters.</p>
      <form onSubmit={handleLogin} className="w-100" style={{ maxWidth: 400 }}>
        <div className="mb-3">
          <input name="email" type="email" className="form-control" placeholder="Email" required />
        </div>
        <div className="mb-3">
          <input name="password" type="password" className="form-control" placeholder="Password" required />
        </div>
        <div className="d-grid gap-2">
          <button type="submit" className="btn btn-dark">Login</button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/account-setup')}>Sign up</button>
        </div>
      </form>
    </div>
  );
}

export default WelcomePage;
