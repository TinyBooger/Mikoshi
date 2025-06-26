import React from 'react';

export default function AccountSetupPage() {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const res = await fetch('/api/account-setup', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    alert(data.message || JSON.stringify(data));

    if (res.ok) {
      window.location.href = '/';
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
          <form onSubmit={handleSubmit} encType="multipart/form-data">
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" name="email" className="form-control" required />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input type="password" name="password" className="form-control" required />
            </div>
            <div className="mb-3">
              <label className="form-label">Name</label>
              <input type="text" name="name" className="form-control" required />
            </div>
            <div className="mb-3">
              <label className="form-label">Profile Picture</label>
              <input type="file" name="profile_pic" className="form-control" accept="image/*" />
            </div>
            <button type="submit" className="btn btn-dark w-100">Submit</button>
          </form>
        </div>
      </div>
    </div>
  );
}
