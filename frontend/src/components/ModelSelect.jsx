import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getModelMultiplier, AVAILABLE_MODEL_IDS } from '../utils/modelConfigs';

/**
 * Custom model selector dropdown with styled multiplier display.
 * Replaces native <select> to allow richer styling per option.
 *
 * Props:
 *  - value:       currently selected model id
 *  - onChange:    (modelId: string) => void
 *  - disabled:    boolean
 *  - className:   forwarded to the trigger button (e.g. "form-select", "form-select form-select-sm")
 *  - style:       forwarded to the trigger button
 */
export default function ModelSelect({ value, onChange, disabled, className, style }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  const selectedId = value || 'deepseek-v4-flash';

  // Close on outside click
  const handleClickOutside = useCallback((e) => {
    if (containerRef.current && !containerRef.current.contains(e.target)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      // Scroll selected item into view
      const selectedEl = listRef.current?.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  const handleSelect = (modelId) => {
    onChange?.(modelId);
    setOpen(false);
  };

  const toggleOpen = () => {
    if (!disabled) setOpen((prev) => !prev);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      containerRef.current?.querySelector('button')?.focus();
    }
  };

  // Merge base button style with any passed style and match Bootstrap form-select look
  const baseBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    textAlign: 'left',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    position: 'relative',
    ...style,
  };

  const dropdownStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1050,
    marginTop: 2,
    background: '#fff',
    border: '1px solid #dee2e6',
    borderRadius: style?.borderRadius || 12,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    maxHeight: 280,
    overflowY: 'auto',
    padding: '4px 0',
  };

  const itemStyle = (isSelected) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    background: isSelected ? '#f0f0ff' : 'transparent',
    color: '#212529',
    transition: 'background 0.1s',
  });

  const multiplierStyle = {
    fontSize: '0.72rem',
    opacity: 0.45,
    flexShrink: 0,
    marginLeft: 12,
    fontWeight: 500,
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={className}
        onClick={toggleOpen}
        disabled={disabled}
        style={baseBtnStyle}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selectedId}</span>
        <span style={{ fontSize: '0.72rem', opacity: 0.45, fontWeight: 500 }}>
          {getModelMultiplier(selectedId)}× ▾
        </span>
      </button>

      {open && (
        <div ref={listRef} style={dropdownStyle} role="listbox">
          {AVAILABLE_MODEL_IDS.map((modelId) => {
            const isSelected = modelId === selectedId;
            return (
              <div
                key={modelId}
                role="option"
                aria-selected={isSelected}
                data-selected={isSelected}
                style={itemStyle(isSelected)}
                onClick={() => handleSelect(modelId)}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = '#f5f6fa';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>{modelId}</span>
                <span style={multiplierStyle}>{getModelMultiplier(modelId)}×</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
