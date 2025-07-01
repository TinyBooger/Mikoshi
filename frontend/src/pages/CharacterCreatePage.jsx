import React, { useState } from 'react';
import { useNavigate } from 'react-router';

export default function CharacterCreatePage() {
  const [name, setName] = useState('');
  const [persona, setPersona] = useState('');
  const [sample, setSample] = useState('');
  const [picture, setPicture] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !persona.trim()) {
      alert("Name and persona are required.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("persona", persona.trim());
    formData.append("sample_dialogue", sample.trim);
    if (picture) formData.append("picture", picture);

    const res = await fetch("/api/create-character", {
      method: "POST",
      body: formData,
      credentials: "include"
    });

    const data = await res.json();
    alert(data.message || data.detail);
    if (res.ok) navigate("/");
  };

  return (
    <main className="flex-grow-1 p-4 overflow-auto">
      <h2 className="mb-4">Create New Character</h2>
      <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
        <div className="mb-3">
          <label className="form-label">Name</label>
          <input className="form-control" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Persona</label>
          <textarea className="form-control" rows="3" required value={persona} onChange={(e) => setPersona(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Sample Dialogue</label>
          <textarea className="form-control" rows="3" value={sample} onChange={(e) => setSample(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Profile Picture</label>
          <input type="file" accept="image/*" className="form-control" onChange={(e) => setPicture(e.target.files[0])} />
        </div>
        <button type="submit" className="btn btn-dark">
          <i className="bi bi-save me-2"></i>Save Character
        </button>
      </form>
    </main>
  );
}
