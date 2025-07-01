import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import TagsInput from '../components/TagsInput';

export default function CharacterEditPage() {
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
      return;
    }

    fetch("/api/current-user").then(res => {
      if (!res.ok) navigate("/");
    });

    fetch(`/api/character/${id}`)
      .then(res => res.json())
      .then(data => {
        setCharData({
          name: data.name,
          persona: data.persona,
          sample: data.example_messages || "",
          tagline: data.tagline || "",
          tags: data.tags || [],
          greeting: data.greeting || "",
        });
      });
  }, [id, navigate]);

  const toggleEdit = field =>
    setEditable(prev => ({ ...prev, [field]: !prev[field] }));

  const handleChange = (field, value) => {
    setCharData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
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
      body: formData,
    });

    const data = await res.json();
    alert(data.message || data.detail || "Update complete");
    if (res.ok) navigate("/profile");
  };

  if (!charData) return null;

  return (
    <div className="d-flex" style={{ height: "100vh" }}>
      <div style={{ width: 250, flexShrink: 0 }}></div>
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <div className="flex-shrink-0"></div>
        <main className="flex-grow-1 p-4">
          <h2 className="mb-4">Edit Character</h2>
          <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
            {["name", "persona", "sample", "tagline", "greeting"].map(field => (
              <div className="mb-3" key={field}>
                <label className="form-label text-capitalize">{field}</label>
                <div className="input-group">
                  {field === "name" || field === "tagline" || field === "greeting" ? (
                    <input
                      type="text"
                      className={`form-control ${editable[field] ? "bg-warning-subtle" : "readonly"}`}
                      value={charData[field]}
                      readOnly={!editable[field]}
                      onChange={e => handleChange(field, e.target.value)}
                    />
                  ) : (
                    <textarea
                      rows={3}
                      className={`form-control ${editable[field] ? "bg-warning-subtle" : "readonly"}`}
                      value={charData[field]}
                      readOnly={!editable[field]}
                      onChange={e => handleChange(field, e.target.value)}
                    />
                  )}
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

            <div className="mb-3">
              <label className="form-label text-capitalize">Tags</label>
              {editable.tags ? (
                <TagsInput tags={charData.tags} setTags={value => handleChange("tags", value)} />
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

            <button type="submit" className="btn btn-dark mt-3">
              <i className="bi bi-save me-2"></i>Save Changes
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
