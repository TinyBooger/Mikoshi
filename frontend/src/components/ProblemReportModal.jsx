
import React, { useState, useContext, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from './AuthProvider';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import TextButton from './TextButton';

export default function ProblemReportModal({ show, onClose, targetType = null, targetId = null, targetName = null }) {
  const { t } = useTranslation();
  const { sessionToken } = useContext(AuthContext);
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const targetSummary = useMemo(() => {
    if (!targetType || !targetId) return null;
    return {
      label: t(`problem_report.target_${targetType}`) || targetType,
      id: targetId,
      name: targetName || ''
    };
  }, [targetType, targetId, targetName, t]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError(t('problem_report.file_too_large'));
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError(t('problem_report.invalid_file_type'));
        return;
      }
      
      setScreenshot(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!description.trim()) {
      setError(t('problem_report.description_required'));
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('description', description.trim());
      
      if (screenshot) {
        // Convert to base64 for simpler storage
        const reader = new FileReader();
        reader.readAsDataURL(screenshot);
        reader.onloadend = async () => {
          formData.append('screenshot', reader.result);
          await submitReport(formData);
        };
      } else {
        await submitReport(formData);
      }
    } catch (err) {
      setError(t('problem_report.submission_error'));
      setLoading(false);
    }
  };

  const submitReport = async (formData) => {
    if (targetType) formData.append('target_type', targetType);
    if (targetId) formData.append('target_id', String(targetId));
    if (targetName) formData.append('target_name', targetName);
    const response = await fetch(`${window.API_BASE_URL}/api/problem-reports`, {
      method: 'POST',
      headers: {
        'Authorization': sessionToken,
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Submission failed');
    }
    
    setSuccess(true);
    setLoading(false);
    
    // Reset form and close after 2 seconds
    setTimeout(() => {
      setDescription('');
      setScreenshot(null);
      setScreenshotPreview(null);
      setSuccess(false);
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    if (!loading) {
      setDescription('');
      setScreenshot(null);
      setScreenshotPreview(null);
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  if (!show) return null;

  const modalContent = (
    <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1200, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{t('problem_report.title')}</h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={handleClose}
              disabled={loading}
              aria-label="Close"
              style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: '#736B92', opacity: 0.7, cursor: 'pointer' }}
            ></button>
          </div>
          <div className="modal-body">
            {targetSummary && (
              <div className="alert alert-light border d-flex align-items-center" role="note">
                <i className="bi bi-flag me-2" aria-hidden="true"></i>
                <div>
                  <div className="fw-semibold">{t('problem_report.reporting_target')}</div>
                  <div className="small text-muted">
                    {targetSummary.label}{targetSummary.name ? `: ${targetSummary.name}` : ''} (ID: {targetSummary.id})
                  </div>
                </div>
              </div>
            )}
            {success ? (
              <div className="alert alert-success text-center">
                <i className="bi bi-check-circle-fill me-2"></i>
                {t('problem_report.success_message')}
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    {t('problem_report.description_label')} <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="5"
                    placeholder={t('problem_report.description_placeholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={loading}
                    maxLength={2000}
                  />
                  <small className="text-muted">
                    {description.length}/2000 {t('problem_report.characters')}
                  </small>
                </div>
                
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    {t('problem_report.screenshot_label')} <small className="text-muted">({t('problem_report.optional')})</small>
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                  <small className="text-muted">{t('problem_report.max_file_size')}</small>
                  
                  {screenshotPreview && (
                    <div className="mt-2">
                      <img 
                        src={screenshotPreview} 
                        alt="Screenshot preview" 
                        style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
                      />
                      <TextButton
                        type="button"
                        onClick={() => {
                          setScreenshot(null);
                          setScreenshotPreview(null);
                        }}
                        disabled={loading}
                        style={{ color: '#d9534f', paddingLeft: 0 }}
                        className="align-middle"
                      >
                        <i className="bi bi-x-circle me-1"></i>
                        {t('problem_report.remove_image')}
                      </TextButton>
                    </div>
                  )}
                </div>
                
                {error && (
                  <div className="alert alert-danger">
                    {error}
                  </div>
                )}
                
                <div className="d-flex justify-content-end gap-2">
                  <SecondaryButton
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    {t('problem_report.cancel')}
                  </SecondaryButton>
                  <PrimaryButton
                    type="submit"
                    disabled={loading || !description.trim()}
                    style={{ minWidth: 110 }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" style={{ width: '1em', height: '1em' }}></span>
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
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
