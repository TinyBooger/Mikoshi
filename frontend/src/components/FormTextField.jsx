import React, { useEffect, useRef } from 'react';
import FormFieldLabel from './FormFieldLabel';
import CharCounter from './CharCounter';
import { FIELD_STYLE, DISABLED_FIELD_STYLE } from './formStyles';

// Grow a textarea to fit its content, capped at a number of lines so very long
// text starts scrolling instead of pushing the rest of the form away.
const resizeToFit = (el, maxRows) => {
  if (!el) return;
  el.style.height = 'auto';
  const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 22;
  const cap = lineHeight * maxRows;
  el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
  el.style.overflowY = el.scrollHeight > cap ? 'auto' : 'hidden';
};

// Field kinds. Both forms pick the same variant for the same logical field, so
// a "summary" or "long text" field always behaves the same way.
const VARIANTS = {
  single: {},
  summary: { multiline: true, autoGrow: true, maxGrowRows: 3 },
  long: { multiline: true, rowsMin: 5, rowsMax: 20, charsPerRow: 80 },
};

/**
 * Bounded text field: label, optional hint, hard `maxLength` cap and the shared
 * over-limit counter.
 */
export default function FormTextField({
  label,
  variant = 'single',
  required = false,
  hint,
  value = '',
  onChange,
  maxLength,
  placeholder = '',
  disabled = false,
  rowsMin,
  rowsMax,
  charsPerRow,
  children,
}) {
  const conf = VARIANTS[variant] || VARIANTS.single;
  const multiline = !!conf.multiline;
  const autoGrow = !!conf.autoGrow;
  const minRows = rowsMin ?? conf.rowsMin;
  const maxRows = rowsMax ?? conf.rowsMax;
  const perRow = charsPerRow ?? conf.charsPerRow;

  const ref = useRef(null);
  useEffect(() => {
    if (autoGrow) resizeToFit(ref.current, conf.maxGrowRows);
  }, [autoGrow, conf.maxGrowRows, value]);

  const rows = multiline && !autoGrow && minRows
    ? Math.max(minRows, Math.min(maxRows, Math.ceil(value.length / perRow)))
    : undefined;

  const style = {
    ...FIELD_STYLE,
    ...(disabled ? DISABLED_FIELD_STYLE : null),
    ...(autoGrow
      ? { resize: 'none', overflow: 'hidden' }
      : multiline ? { resize: 'vertical' } : null),
  };

  const inputProps = {
    className: 'form-control',
    value,
    placeholder,
    maxLength,
    disabled,
    onChange: e => onChange(e.target.value),
    style,
    ...(autoGrow ? { onInput: e => resizeToFit(e.target, conf.maxGrowRows) } : null),
  };

  return (
    <div className="mb-4 position-relative">
      <FormFieldLabel required={required} hint={hint}>{label}</FormFieldLabel>
      {multiline ? (
        <textarea ref={ref} rows={autoGrow ? 1 : rows} {...inputProps} />
      ) : (
        <input type="text" {...inputProps} />
      )}
      {maxLength != null && <CharCounter value={value} max={maxLength} />}
      {children}
    </div>
  );
}
