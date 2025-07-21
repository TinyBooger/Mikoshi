import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import TagsInput from '../components/TagsInput'; // adjust path as needed
import { AuthContext } from '../components/AuthProvider';

export default function CharacterCreatePage() {
  const MAX_NAME_LENGTH = 50;
  const MAX_PERSONA_LENGTH = 1000;
  const MAX_TAGLINE_LENGTH = 200;
  const MAX_GREETING_LENGTH = 500;
  const MAX_SAMPLE_LENGTH = 1000;
  const MAX_TAGS = 20;

  const [name, setName] = useState('');
  const [persona, setPersona] = useState('');
  const [greeting, setGreeting] = useState('');
  const [tagline, setTagline] = useState('');
  const [tags, setTags] = useState([]);
  const [sample, setSample] = useState('');
  const [picture, setPicture] = useState(null);
  const navigate = useNavigate();
  const { idToken } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!idToken) {
      alert("You need to be logged in to create a character.");
      navigate('/');
      return;
    }

    if (!name.trim() || !persona.trim()) {
      alert("Name and persona are required.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("persona", persona.trim());
    formData.append("tagline", tagline.trim());
    tags.forEach(tag => formData.append("tags", tag));
    formData.append("greeting", greeting.trim());
    formData.append("sample_dialogue", sample.trim());
    if (picture) formData.append("picture", picture);

    try {
      const res = await fetch("/api/create-character", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        alert("Character created successfully!");
        navigate("/");
      } else {
        alert(data.message || data.detail || "Failed to create character");
      }
    } catch (error) {
      console.error("Error creating character:", error);
      alert("An error occurred while creating the character");
    }
  };

  return (
    <div className="flex-grow-1 p-4 overflow-auto">
      <h2 className="mb-4">Create New Character</h2>
      <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
        <div className="mb-3 position-relative">
          <label className="form-label">Name</label>
          <input
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

        <div className="mb-3 position-relative">
          <label className="form-label">Persona</label>
          <textarea
            className="form-control"
            rows="3"
            required
            value={persona}
            maxLength={MAX_PERSONA_LENGTH}
            onChange={(e) => setPersona(e.target.value)}
            style={{ paddingRight: "3rem" }}
          />
          <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
            {persona.length}/{MAX_PERSONA_LENGTH}
          </small>
        </div>

        <div className="mb-3 position-relative">
          <label className="form-label">Tagline</label>
          <input
            className="form-control"
            value={tagline}
            maxLength={MAX_TAGLINE_LENGTH}
            onChange={(e) => setTagline(e.target.value)}
            style={{ paddingRight: "3rem" }}
          />
          <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
            {tagline.length}/{MAX_TAGLINE_LENGTH}
          </small>
        </div>

        <div className="mb-3 position-relative">
          <label className="form-label">Greeting (optional)</label>
          <input
            className="form-control"
            value={greeting}
            maxLength={MAX_GREETING_LENGTH}
            onChange={(e) => setGreeting(e.target.value)}
            style={{ paddingRight: "3rem" }}
          />
          <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
            {greeting.length}/{MAX_GREETING_LENGTH}
          </small>
        </div>

        <div className="mb-3 position-relative">
          <label className="form-label">Tags</label>
          <TagsInput tags={tags} setTags={setTags} maxTags={MAX_TAGS} />
          <small className="text-muted" style={{ top: 0, right: 0 }}>
            {tags.length}/{MAX_TAGS} tags
          </small>
        </div>

        <div className="mb-3 position-relative">
          <label className="form-label">Sample Dialogue</label>
          <textarea
            className="form-control"
            rows="3"
            value={sample}
            maxLength={MAX_SAMPLE_LENGTH}
            onChange={(e) => setSample(e.target.value)}
            style={{ paddingRight: "3rem" }}
          />
          <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
            {sample.length}/{MAX_SAMPLE_LENGTH}
          </small>
        </div>

        <div className="mb-3">
          <label className="form-label">Profile Picture</label>
          <input
            type="file"
            accept="image/*"
            className="form-control"
            onChange={(e) => setPicture(e.target.files[0])}
          />
        </div>

        <button type="submit" className="btn btn-dark">
          <i className="bi bi-save me-2"></i>Save Character
        </button>
      </form>
    </div>
  );
}