import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router";
import TagsInput from '../components/TagsInput';
import { AuthContext } from '../components/AuthProvider';

export default function CharacterEditPage() {
  const MAX_NAME_LENGTH = 50;
  const MAX_PERSONA_LENGTH = 1000;
  const MAX_TAGLINE_LENGTH = 200;
  const MAX_GREETING_LENGTH = 500;
  const MAX_SAMPLE_LENGTH = 1000;
  const MAX_TAGS = 20;

  const { userData, idToken } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const navigate = useNavigate();
  const [charData, setCharData] = useState(null);
  const [picture, setPicture] = useState(null);

  const [editable, setEditable] = useState({
    name: false,
    persona: false,
    sample: false,
    tagline: false,
    tags: false,
    greeting: false,
  });

  useEffect(() => {
    if (!id) {
      alert("Missing character ID");
      navigate("/");
      return;
    }

    if (!idToken) {
      navigate("/");
      return;
    }

    fetch(`/api/character/${id}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    })
      .then(res => {
        if (!res.ok) {
          navigate("/");
          return;
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setCharData({
          name: data.name,
          persona: data.persona,
          sample: data.example_messages || "",
          tagline: data.tagline || "",
          tags: data.tags || [],
          greeting: data.greeting || "",
        });
      });
  }, [id, navigate, idToken]);

  const toggleEdit = field =>
    setEditable(prev => ({ ...prev, [field]: !prev[field] }));

  const handleChange = (field, value) => {
    setCharData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!idToken) {
      navigate("/");
      return;
    }

    const formData = new FormData();
    formData.append("id", id);
    formData.append("name", charData.name);
    formData.append("persona", charData.persona);
    formData.append("sample_dialogue", charData.sample);
    formData.append("tagline", charData.tagline);
    charData.tags.forEach(tag => formData.append("tags", tag));
    formData.append("greeting", charData.greeting);
    if (picture) formData.append("picture", picture);

    const res = await fetch("/api/update-character", {
      method: "POST",
      headers: { 'Authorization': `Bearer ${idToken}` },
      body: formData,
    });

    const data = await res.json();
    alert(data.message || data.detail || "Update complete");
    if (res.ok) navigate("/profile");
  };

  const handleDelete = async () => {
    if (!idToken) {
      navigate("/");
      return;
    }

    if (window.confirm("Are you sure you want to delete this character?")) {
      const res = await fetch(`/api/character/${id}/delete`, { 
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      const data = await res.json();
      alert(data.message || data.detail || "Character deleted");
      if (res.ok) navigate("/profile");
    }
  };

  if (!charData) return null;

  return (
    <div
      style={{
        width: '90%',
        margin: '0 auto',
        background: 'var(--bs-body-bg, #f8f9fa)',
        minHeight: '100vh',
        paddingLeft: '2.5rem',
        paddingRight: '2.5rem',
        paddingTop: '2rem',
        paddingBottom: '2rem',
        boxSizing: 'border-box',
        maxWidth: '900px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <div className="w-100" style={{ maxWidth: 600 }}>
        <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>Edit Character</h2>
        <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data" style={{
          background: '#fff',
          borderRadius: '1.2rem',
          boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
          padding: '2.5rem 2rem 2rem 2rem',
          border: '1.5px solid #e9ecef'
        }}>
          {["name", "persona", "sample", "tagline", "greeting"].map(field => (
            <div className="mb-4 position-relative" key={field}>
              <label className="form-label text-capitalize fw-semibold" style={{ color: '#232323', fontSize: '1.08rem', letterSpacing: '0.2px' }}>{field}</label>
              {field === "name" || field === "tagline" || field === "greeting" ? (
                <>
                  <div className="input-group">
                    <input
                      type="text"
                      className={`form-control ${editable[field] ? "bg-light border-dark-subtle" : "readonly"}`}
                      style={{
                        background: editable[field] ? '#f5f6fa' : '#f8f9fa',
                        border: editable[field] ? '1.5px solid #232323' : '1.5px solid #e9ecef',
                        color: '#232323',
                        fontWeight: 500,
                        fontSize: '1.05rem',
                        borderRadius: '0.7rem',
                        boxShadow: 'none',
                        paddingRight: "3.5rem"
                      }}
                      value={charData[field]}
                      readOnly={!editable[field]}
                      maxLength={
                        field === "name" ? MAX_NAME_LENGTH :
                        field === "tagline" ? MAX_TAGLINE_LENGTH :
                        MAX_GREETING_LENGTH
                      }
                      onChange={e => handleChange(field, e.target.value)}
                    />
                    <button
                      type="button"
                      className={`btn ${editable[field] ? "btn-outline-success" : "btn-outline-secondary"}`}
                      style={{
                        borderRadius: '0.7rem',
                        border: 'none',
                        marginLeft: '-3rem',
                        zIndex: 2,
                        background: editable[field] ? '#e9ecef' : '#f8f9fa'
                      }}
                      onClick={() => toggleEdit(field)}
                      tabIndex={-1}
                    >
                      <i className={`bi ${editable[field] ? "bi-check" : "bi-pencil"}`}></i>
                    </button>
                  </div>
                  {editable[field] && (
                    <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
                      {charData[field].length}/{
                        field === "name" ? MAX_NAME_LENGTH :
                        field === "tagline" ? MAX_TAGLINE_LENGTH :
                        MAX_GREETING_LENGTH
                      }
                    </small>
                  )}
                </>
              ) : (
                <>
                  <div className="input-group">
                    <textarea
                      rows={field === "persona" ? 4 : 3}
                      className={`form-control ${editable[field] ? "bg-light border-dark-subtle" : "readonly"}`}
                      style={{
                        background: editable[field] ? '#f5f6fa' : '#f8f9fa',
                        border: editable[field] ? '1.5px solid #232323' : '1.5px solid #e9ecef',
                        color: '#232323',
                        fontWeight: 500,
                        fontSize: '1.05rem',
                        borderRadius: '0.7rem',
                        boxShadow: 'none',
                        paddingRight: "3.5rem",
                        resize: 'vertical'
                      }}
                      value={charData[field]}
                      readOnly={!editable[field]}
                      maxLength={
                        field === "persona" ? MAX_PERSONA_LENGTH : MAX_SAMPLE_LENGTH
                      }
                      onChange={e => handleChange(field, e.target.value)}
                    />
                    <button
                      type="button"
                      className={`btn ${editable[field] ? "btn-outline-success" : "btn-outline-secondary"}`}
                      style={{
                        borderRadius: '0.7rem',
                        border: 'none',
                        marginLeft: '-3rem',
                        zIndex: 2,
                        background: editable[field] ? '#e9ecef' : '#f8f9fa'
                      }}
                      onClick={() => toggleEdit(field)}
                      tabIndex={-1}
                    >
                      <i className={`bi ${editable[field] ? "bi-check" : "bi-pencil"}`}></i>
                    </button>
                  </div>
                  {editable[field] && (
                    <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
                      {charData[field].length}/{
                        field === "persona" ? MAX_PERSONA_LENGTH : MAX_SAMPLE_LENGTH
                      }
                    </small>
                  )}
                </>
              )}
            </div>
          ))}

          <div className="mb-4 position-relative">
            <label className="form-label fw-semibold" style={{ color: '#232323', fontSize: '1.08rem', letterSpacing: '0.2px' }}>Tags</label>
            {editable.tags ? (
              <>
                <TagsInput tags={charData.tags} setTags={value => handleChange("tags", value)} maxTags={MAX_TAGS} />
                <small className="text-muted">
                  {charData.tags.length}/{MAX_TAGS} tags
                </small>
                <button
                  type="button"
                  className="btn btn-outline-success ms-2"
                  style={{
                    borderRadius: '0.7rem',
                    border: 'none',
                    background: '#e9ecef',
                    marginTop: '-2.2rem',
                    float: 'right'
                  }}
                  onClick={() => toggleEdit("tags")}
                  tabIndex={-1}
                >
                  <i className="bi bi-check"></i>
                </button>
              </>
            ) : (
              <div className="input-group">
                <input
                  type="text"
                  className="form-control readonly"
                  style={{
                    background: '#f8f9fa',
                    border: '1.5px solid #e9ecef',
                    color: '#232323',
                    fontWeight: 500,
                    fontSize: '1.05rem',
                    borderRadius: '0.7rem'
                  }}
                  value={charData.tags.join(", ")}
                  readOnly
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  style={{
                    borderRadius: '0.7rem',
                    border: 'none',
                    marginLeft: '-3rem',
                    zIndex: 2,
                    background: '#f8f9fa'
                  }}
                  onClick={() => toggleEdit("tags")}
                  tabIndex={-1}
                >
                  <i className="bi bi-pencil"></i>
                </button>
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold" style={{ color: '#232323', fontSize: '1.08rem', letterSpacing: '0.2px' }}>Profile Picture</label>
            <input
              type="file"
              className="form-control"
              style={{
                background: '#f8f9fa',
                border: '1.5px solid #e9ecef',
                borderRadius: '0.7rem'
              }}
              accept="image/*"
              onChange={e => setPicture(e.target.files[0])}
            />
          </div>

          <div className="d-flex gap-3 mt-4 justify-content-end">
            <button
              type="submit"
              className="fw-bold rounded-pill"
              style={{
                background: '#18191a',
                color: '#fff',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                fontSize: '1.08rem',
                padding: '0.5rem 2.2rem',
                letterSpacing: '0.2px',
                transition: 'background 0.18s, color 0.18s',
                outline: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#232323';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#18191a';
              }}
            >
              <i className="bi bi-save me-2"></i>Save Changes
            </button>
            <button
              type="button"
              className="fw-bold rounded-pill"
              style={{
                background: '#fff',
                color: '#d32f2f',
                border: '1.5px solid #d32f2f',
                boxShadow: 'none',
                fontSize: '1.08rem',
                padding: '0.5rem 2.2rem',
                letterSpacing: '0.2px',
                transition: 'background 0.18s, color 0.18s, border 0.18s',
                outline: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#d32f2f';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.color = '#d32f2f';
              }}
              onClick={handleDelete}
            >
              <i className="bi bi-trash me-2"></i>Delete Character
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}