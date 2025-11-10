import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../components/AuthProvider';

export default function TagsInput({ tags, setTags, maxTags, placeholder }) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { sessionToken } = useContext(AuthContext);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const url = input.trim() === "" 
          ? `${window.API_BASE_URL}/api/tag-suggestions` 
          : `${window.API_BASE_URL}/api/tag-suggestions?q=${encodeURIComponent(input.trim())}`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': sessionToken
          }
        });

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error('Error fetching tag suggestions:', error);
        setSuggestions([]);
      }
    };

    if (sessionToken) {
      fetchSuggestions();
    }
  }, [input, sessionToken]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      addTag(input.trim());
    }
  };

  const addTag = (tag) => {
    if (tags.length < maxTags && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="d-flex flex-wrap gap-2 p-2 border rounded position-relative">
      {tags.map((tag, i) => (
        <div key={i} className="badge bg-secondary d-flex align-items-center">
          {tag}
          <button
            type="button"
            className="btn-close btn-close-white ms-1"
            onClick={() => removeTag(i)}
            style={{ fontSize: "0.7rem" }}
          ></button>
        </div>
      ))}
      <input
        type="text"
        className="border-0 flex-grow-1"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
        placeholder={placeholder || "Add a tag and press Enter"}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="position-absolute border rounded p-2 d-flex flex-wrap gap-2"
          style={{ background: '#f8f9fa', top: '100%', left: 0, right: 0, zIndex: 10 }}
        >
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="badge bg-light text-dark border d-flex align-items-center"
              style={{ cursor: 'pointer' }}
              onMouseDown={() => addTag(s.name)} // use onMouseDown to avoid blur before click
            >
              {s.name}
              <i className="bi bi-plus ms-1"></i>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}