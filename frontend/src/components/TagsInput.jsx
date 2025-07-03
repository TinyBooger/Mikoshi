import React, { useState, useEffect } from 'react';

export default function TagsInput({ tags, setTags }) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (input.trim() === "") {
      fetch("/api/tag-suggestions")
        .then(res => res.json())
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    } else {
      fetch(`/api/tag-suggestions?q=${encodeURIComponent(input.trim())}`)
        .then(res => res.json())
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      addTag(input.trim());
    }
  };

  const addTag = (tag) => {
    if (!tags.includes(tag)) {
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
        placeholder="Add a tag and press Enter"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="list-group position-absolute w-100" style={{ top: '100%', zIndex: 10, maxHeight: 150, overflowY: 'auto' }}>
          {suggestions.map(s => (
            <li
              key={s.name}
              className="list-group-item list-group-item-action"
              style={{ cursor: 'pointer' }}
              onMouseDown={() => addTag(s.name)}
            >
              {s.name} <small className="text-muted">({s.count})</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
