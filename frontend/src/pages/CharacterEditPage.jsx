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
    <div className="d-flex" style={{ height: "100vh" }}>
      <div style={{ width: 250, flexShrink: 0 }}></div>
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <div className="flex-shrink-0"></div>
        <div className="flex-grow-1 p-4">
          <h2 className="mb-4">Edit Character</h2>
          <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
            {["name", "persona", "sample", "tagline", "greeting"].map(field => (
              <div className="mb-3 position-relative" key={field}>
                <label className="form-label text-capitalize">{field}</label>
                {field === "name" || field === "tagline" || field === "greeting" ? (
                  <>
                    <input
                      type="text"
                      className={`form-control ${editable[field] ? "bg-warning-subtle" : "readonly"}`}
                      value={charData[field]}
                      readOnly={!editable[field]}
                      maxLength={
                        field === "name" ? MAX_NAME_LENGTH :
                        field === "tagline" ? MAX_TAGLINE_LENGTH :
                        MAX_GREETING_LENGTH
                      }
                      onChange={e => handleChange(field, e.target.value)}
                      style={{ paddingRight: "3rem" }}
                    />
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
                    <textarea
                      rows={3}
                      className={`form-control ${editable[field] ? "bg-warning-subtle" : "readonly"}`}
                      value={charData[field]}
                      readOnly={!editable[field]}
                      maxLength={
                        field === "persona" ? MAX_PERSONA_LENGTH : MAX_SAMPLE_LENGTH
                      }
                      onChange={e => handleChange(field, e.target.value)}
                      style={{ paddingRight: "3rem" }}
                    />
                    {editable[field] && (
                      <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
                        {charData[field].length}/{
                          field === "persona" ? MAX_PERSONA_LENGTH : MAX_SAMPLE_LENGTH
                        }
                      </small>
                    )}
                  </>
                )}
                <div className="input-group-append">
                  {!editable[field] ? (
                    <button type="button" className="btn btn-outline-secondary" onClick={() => toggleEdit(field)}>
                      <i className="bi bi-pencil"></i>
                    </button>
                  ) : (
                    <button type="button" className="btn btn-outline-success" onClick={() => toggleEdit(field)}>
                      <i className="bi bi-check"></i>
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="mb-3 position-relative">
              <label className="form-label">Tags</label>
              {editable.tags ? (
                <>
                  <TagsInput tags={charData.tags} setTags={value => handleChange("tags", value)} maxTags={MAX_TAGS} />
                  <small className="text-muted">
                    {charData.tags.length}/{MAX_TAGS} tags
                  </small>
                </>
              ) : (
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control readonly"
                    value={charData.tags.join(", ")}
                    readOnly
                  />
                  <button type="button" className="btn btn-outline-secondary" onClick={() => toggleEdit("tags")}>
                    <i className="bi bi-pencil"></i>
                  </button>
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label">Profile Picture</label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={e => setPicture(e.target.files[0])}
              />
            </div>

            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-dark mt-3">
                <i className="bi bi-save me-2"></i>Save Changes
              </button>
              <button
                type="button"
                className="btn btn-danger mt-3 ms-2"
                onClick={handleDelete}
              >
                <i className="bi bi-trash me-2"></i>Delete Character
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}