
import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../components/AuthProvider';
import TextButton from './TextButton';

// Both half-width "," and full-width "，" (Chinese) commas separate tags.
const TAG_SEPARATOR = /[,，]/;

export default function TagsInput({ tags, setTags, maxTags, placeholder, hint }) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { sessionToken } = useContext(AuthContext);
  const { t } = useTranslation();

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

  const addTags = (tagList) => {
    const accepted = [];
    for (const tag of tagList) {
      if (
        tags.length + accepted.length < maxTags &&
        !tags.includes(tag) &&
        !accepted.includes(tag)
      ) {
        accepted.push(tag);
      }
    }
    if (accepted.length > 0) {
      setTags([...tags, ...accepted]);
    }
  };

  const addTag = (tag) => {
    addTags([tag]);
    setInput("");
  };

  const splitTagText = (text) =>
    text.split(TAG_SEPARATOR).map((part) => part.trim()).filter(Boolean);

  const handleInputChange = (e) => {
    const value = e.target.value;
    // While an IME composition (e.g. Chinese pinyin) is in progress, keep the raw
    // text and only split once the composition has been confirmed.
    if (e.nativeEvent.isComposing) {
      setInput(value);
      return;
    }
    if (TAG_SEPARATOR.test(value)) {
      // Commit everything before the last comma right away, and keep the text
      // after it in the input so the user can keep typing.
      const segments = value.split(TAG_SEPARATOR);
      addTags(
        segments.slice(0, -1).map((part) => part.trim()).filter(Boolean)
      );
      setInput(segments[segments.length - 1].replace(/^\s+/, ""));
    } else {
      setInput(value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      addTags(splitTagText(input));
      setInput("");
    }
  };

  const commitPendingInput = () => {
    if (input.trim()) {
      addTags(splitTagText(input));
      setInput("");
    }
  };

  const handleBlur = () => {
    // Auto-confirm typed-but-unconfirmed tags when the field loses focus, e.g.
    // the user clicked the submit button or another field, tabbed away, or
    // dismissed the mobile keyboard — so pending text is never silently dropped.
    commitPendingInput();
    setTimeout(() => setShowSuggestions(false), 100);
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
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={handleBlur}
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