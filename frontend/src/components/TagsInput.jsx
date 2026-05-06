
import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../components/AuthProvider';
import TextButton from './TextButton';

export default function TagsInput({ tags, setTags, maxTags, placeholder, hint }) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { sessionToken } = useContext(AuthContext);
  const { t } = useTranslation();
  const trimmedInput = input.trim();

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
    if (e.key === "Enter" && trimmedInput) {
      e.preventDefault();
      addTag(trimmedInput);
    }
  };

  const addTag = (tag) => {
    if (tags.length < maxTags && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setInput("");
  };

  const removeTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  return (
    <>
      <style>{`
        .tags-input-field::placeholder {
          color: #c5ccd3;
          opacity: 1;
        }
      `}</style>
      <div
        className="d-flex flex-wrap gap-2 position-relative"
        style={{
          background: '#f5f6fa',
          border: '1.5px solid #e9ecef',
          borderRadius: 16,
          padding: '0.7rem 1rem',
        }}
      >
        {tags.map((tag, i) => (
          <div key={i} className="badge bg-secondary d-flex align-items-center">
            {tag}
            <TextButton
              type="button"
              onClick={() => removeTag(i)}
              style={{ fontSize: '0.7rem', color: '#fff', marginLeft: 4, padding: 0, background: 'none' }}
              aria-label="Remove tag"
            >
              <i className="bi bi-x-circle"></i>
            </TextButton>
          </div>
        ))}
        <input
          type="text"
          className="border-0 flex-grow-1 tags-input-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
          enterKeyHint="done"
          autoCorrect="off"
          autoCapitalize="none"
          placeholder={placeholder || "Type a tag and press Enter"}
          style={{
            minWidth: 120,
            flex: '1 1 140px',
            background: 'transparent',
            outline: 'none',
            boxShadow: 'none',
            color: '#18191a',
            fontSize: '1.08rem',
          }}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div
            className="position-absolute p-2 d-flex flex-wrap gap-2"
            style={{
              background: '#f5f6fa',
              border: '1.5px solid #e9ecef',
              borderRadius: 14,
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              zIndex: 20,
              maxHeight: 220,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="d-inline-flex align-items-center"
                style={{
                  cursor: 'pointer',
                  background: '#ffffff',
                  color: '#374151',
                  border: '1px solid #dbe2ea',
                  borderRadius: 999,
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.86rem',
                  lineHeight: 1.2,
                  minHeight: 32,
                }}
                onMouseDown={() => addTag(s.name)} // use onMouseDown to avoid blur before click
              >
                {s.name}
                <i className="bi bi-plus ms-1"></i>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}