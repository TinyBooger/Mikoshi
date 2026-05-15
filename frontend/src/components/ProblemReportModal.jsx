
import React, { useState, useContext, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from './AuthProvider';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

const REASON_CATEGORIES = {
  character: ['inappropriate_content', 'spam', 'harassment', 'copyright', 'other'],
  scene:     ['inappropriate_content', 'spam', 'harassment', 'copyright', 'other'],
  user:      ['harassment', 'spam', 'impersonation', 'offensive_profile', 'other'],
  general:   ['bug', 'ux_issue', 'inappropriate_content', 'other'],
};

const REASON_ICONS = {
  inappropriate_content: 'bi-slash-circle',
  spam:                  'bi-megaphone',
  harassment:            'bi-exclamation-octagon',
  copyright:             'bi-c-circle',
  impersonation:         'bi-person-x',
  offensive_profile:     'bi-person-slash',
  bug:                   'bi-bug',
  ux_issue:              'bi-layout-text-window',
  other:                 'bi-three-dots',
};

export default function ProblemReportModal({
  show,
  onClose,
  targetType = null,
  targetId = null,
  targetName = null,
  targetStringId = null,
}) {
  const { t } = useTranslation();
  const { sessionToken } = useContext(AuthContext);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const categories = REASON_CATEGORIES[targetType] || REASON_CATEGORIES.general;

  const targetSummary = useMemo(() => {
    if (!targetType) return null;
    return {
      label: t(`problem_report.target_${targetType}`) || targetType,
      id: targetId || targetStringId,
      name: targetName || '',
    };
  }, [targetType, targetId, targetStringId, targetName, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason) {
      setError(t('problem_report.reason_required'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('reason', reason);
      if (description.trim()) formData.append('description', description.trim());
      if (targetType) formData.append('target_type', targetType);
      if (targetId != null) formData.append('target_id', String(targetId));
      if (targetName) formData.append('target_name', targetName);
      if (targetStringId) formData.append('target_string_id', targetStringId);

      const response = await fetch(`${window.API_BASE_URL}/api/problem-reports`, {
        method: 'POST',
        headers: { Authorization: sessionToken },
        body: formData,
      });

      if (!response.ok) throw new Error('Submission failed');

      setSuccess(true);
      setTimeout(() => {
        setReason('');
        setDescription('');
        setSuccess(false);
        onClose();
      }, 2000);
    } catch {
      setError(t('problem_report.submission_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason('');
      setDescription('');
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  if (!show) return null;

  const modalContent = (
    <div
      tabIndex="-1"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '1.2rem',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          width: '100%',
          maxWidth: 480,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.1rem 1.4rem 0.85rem',
            borderBottom: '1px solid #f0eff6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <i
              className="bi bi-exclamation-triangle-fill"
              style={{ color: '#e67e22', fontSize: '1.15rem' }}
            />
            <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: '#1a1a2e' }}>
              {t('problem_report.title')}
            </h5>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              lineHeight: 1,
              color: '#888',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 6,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.2rem 1.4rem 1.4rem' }}>
          {/* Target context */}
          {targetSummary && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 0.8rem',
                borderRadius: '10px',
                background: '#f8f6ff',
                border: '1px solid #e9e4f8',
                marginBottom: '1.1rem',
              }}
            >
              <i
                className="bi bi-exclamation-triangle"
                style={{ color: '#9068d0', fontSize: '0.95rem', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6f42c1' }}>
                  {t('problem_report.reporting_target')}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#555' }}>
                  {targetSummary.label}
                  {targetSummary.name ? `: ${targetSummary.name}` : ''}
                </div>
              </div>
            </div>
          )}

          {success ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#22863a' }}>
              <i
                className="bi bi-check-circle-fill"
                style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.8rem' }}
              />
              <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                {t('problem_report.success_message')}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Reason selection */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    color: '#333',
                    marginBottom: '0.55rem',
                  }}
                >
                  {t('problem_report.reason_label')}{' '}
                  <span style={{ color: '#dc3545' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {categories.map((cat) => {
                    const selected = reason === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setReason(cat); setError(''); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.58rem 0.85rem',
                          borderRadius: '10px',
                          border: `2px solid ${selected ? '#a590dc' : '#e8e5f0'}`,
                          background: selected ? 'rgba(165,144,220,0.10)' : '#fafafa',
                          color: selected ? '#6f42c1' : '#444',
                          fontWeight: selected ? 700 : 500,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!selected) e.currentTarget.style.borderColor = '#c4b8e8';
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) e.currentTarget.style.borderColor = '#e8e5f0';
                        }}
                      >
                        <i
                          className={`bi ${selected ? 'bi-check-circle-fill' : (REASON_ICONS[cat] || 'bi-circle')}`}
                          style={{ fontSize: '1rem', flexShrink: 0, color: selected ? '#a590dc' : '#aaa' }}
                        />
                        {t(`problem_report.reason_${cat}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional description */}
              <div style={{ marginBottom: error ? '0.75rem' : '1.1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    color: '#333',
                    marginBottom: '0.4rem',
                  }}
                >
                  {t('problem_report.description_label')}{' '}
                  <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#999' }}>
                    ({t('problem_report.optional')})
                  </span>
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder={
                    t(`problem_report.description_placeholder_${targetType || 'general'}`, '') ||
                    t('problem_report.description_placeholder')
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  maxLength={2000}
                  style={{ fontSize: '0.88rem', borderRadius: '10px' }}
                />
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#aaa', marginTop: '2px' }}>
                  {description.length}/2000
                </div>
              </div>

              {error && (
                <div
                  className="alert alert-danger"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '8px', marginBottom: '0.75rem' }}
                >
                  {error}
                </div>
              )}

              <div className="d-flex justify-content-end gap-2">
                <SecondaryButton type="button" onClick={handleClose} disabled={loading}>
                  {t('problem_report.cancel')}
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={loading || !reason} style={{ minWidth: 110 }}>
                  {loading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        style={{ width: '1em', height: '1em' }}
                      />
                      {t('problem_report.submitting')}
                    </>
                  ) : (
                    t('problem_report.submit')
                  )}
                </PrimaryButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
