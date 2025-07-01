import React, { useState } from 'react';

export default function TagsInput({ tags, setTags }) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        setTags([...tags, input.trim()]);
      }
      setInput("");
    }
  };

  const removeTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="d-flex flex-wrap gap-2 p-2 border rounded">
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
        placeholder="Add a tag and press Enter"
      />
    </div>
  );
}
