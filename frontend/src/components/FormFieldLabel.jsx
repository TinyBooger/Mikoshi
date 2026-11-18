import React from 'react';

/**
 * Form label with the required marker and optional inline hint. Shared by the
 * character and entity forms so required markers and hints look identical.
 */
export default function FormFieldLabel({ children, required = false, hint, htmlFor, className = 'form-label fw-bold' }) {
  return (
    <label className={className} style={{ color: '#232323' }} htmlFor={htmlFor}>
      {children}
      {required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      {hint && (
        <small style={{ marginLeft: 8, fontSize: '0.8rem', color: '#9ca3af', fontWeight: 400 }}>
          {hint}
        </small>
      )}
    </label>
  );
}
