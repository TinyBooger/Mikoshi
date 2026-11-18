import React from 'react';
import FormFieldLabel from './FormFieldLabel';

const ACCEPTED_FORMATS = '支持 JPG / PNG / GIF / WebP / BMP / TIFF';

/**
 * Cover image picker with optional avatar overlay and preset images. Both forms
 * use it so the upload affordance, preview and optional avatar preview match.
 */
export default function FormPictureField({
  id,
  label,
  required = false,
  hint,
  placeholder = '点击上传封面图片',
  preview,
  aspectRatio,
  onAspectRatioChange,
  onSelectFile,
  avatarPreview,
  showAvatar = false,
  presets = [],
  selectedPreset = null,
  onSelectPreset,
  footer,
}) {
  const handleFile = e => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    // Reset so selecting the same file again still triggers onChange.
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onSelectFile(file, reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="mb-4">
      <FormFieldLabel required={required} hint={hint}>{label}</FormFieldLabel>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 'min(360px, 100%)',
          aspectRatio: preview ? String(aspectRatio || 1) : '1 / 1',
          marginBottom: 12,
        }}
      >
        <label
          htmlFor={id}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            borderRadius: 16,
            background: '#f5f6fa',
            border: '1.5px solid #e9ecef',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt="预览"
              onLoad={e => {
                const nextRatio = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight;
                if (Number.isFinite(nextRatio) && nextRatio > 0) {
                  onAspectRatioChange(nextRatio);
                }
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#eef2f7' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: '#94a3b8',
                gap: 8,
                fontSize: '0.95rem',
              }}
            >
              <i className="bi bi-image" style={{ fontSize: '1.7rem' }}></i>
              <span>{placeholder}</span>
              <span style={{ fontSize: '0.82rem' }}>{ACCEPTED_FORMATS}</span>
            </div>
          )}
          <input id={id} type="file" accept="image/*" className="d-none" onChange={handleFile} />
        </label>

        {showAvatar && (
          <div
            style={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                overflow: 'hidden',
                borderRadius: '50%',
                background: '#fff',
                border: '1px solid #e9ecef',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.18)',
              }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="头像预览" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.75rem' }}>头像</div>
              )}
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                lineHeight: 1,
                color: '#475569',
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: 999,
                padding: '0.18rem 0.45rem',
                border: '1px solid #e2e8f0',
              }}
            >
              头像预览
            </span>
          </div>
        )}
      </div>

      {presets.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {presets.map(pic => {
            const selected = selectedPreset === pic.src;
            return (
              <div
                key={pic.name}
                onClick={() => onSelectPreset(pic.src, `${pic.name}.png`)}
                title={selected ? `${pic.label} — 点击取消选择` : pic.label}
                style={{
                  position: 'relative',
                  width: 80,
                  height: 80,
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: selected ? '3px solid #7c3aed' : '2px solid #e9ecef',
                  boxShadow: selected ? '0 0 0 3px rgba(124, 58, 237, 0.25)' : 'none',
                  transition: 'border 0.15s, box-shadow 0.15s',
                  flexShrink: 0,
                }}
              >
                <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }}>
                  <img src={pic.src} alt={pic.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                {selected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#7c3aed',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      lineHeight: 1,
                      pointerEvents: 'none',
                    }}
                  >
                    ×
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {footer}
    </div>
  );
}
