import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthProvider';

/**
 * Modal for submitting or viewing a ban appeal.
 * Props:
 *  - onClose: callback to close the modal
 */
export default function AppealModal({ onClose }) {
  const { sessionToken } = useContext(AuthContext);

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingAppeal, setExistingAppeal] = useState(undefined); // undefined = loading
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Check if the user already has an appeal
  useEffect(() => {
    async function fetchExisting() {
      try {
        const res = await fetch(`${window.API_BASE_URL}/api/me/ban-appeal`, {
          headers: { Authorization: sessionToken },
        });
        if (res.status === 404 || res.status === 204) {
          setExistingAppeal(null);
          return;
        }
        const data = await res.json();
        setExistingAppeal(data || null);
      } catch {
        setExistingAppeal(null);
      }
    }
    fetchExisting();
  }, [sessionToken]);

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('请填写申诉理由。');
      return;
    }
    if (trimmed.length > 2000) {
      setError('申诉理由不能超过 2000 字。');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/me/ban-appeal`, {
        method: 'POST',
        headers: {
          Authorization: sessionToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || '提交失败，请稍后重试。');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('提交失败，请检查网络后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const BAN_TYPE_LABELS = {
    full_ban: '完全封禁',
    upload_ban: '内容发布封禁',
    shadow_ban: '影子封禁',
  };

  const STATUS_LABELS = {
    pending: { label: '待审核', cls: 'bg-warning text-dark' },
    approved: { label: '已通过', cls: 'bg-success' },
    rejected: { label: '未通过', cls: 'bg-danger' },
  };

  const renderBody = () => {
    // Loading state
    if (existingAppeal === undefined) {
      return (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm" role="status" />
        </div>
      );
    }

    // Submitted successfully in this session
    if (submitted) {
      return (
        <div className="text-center py-3">
          <i className="bi bi-check-circle-fill text-success fs-1" />
          <div className="mt-2 fw-semibold">申诉已提交</div>
          <div className="text-muted small mt-1">
            管理员将尽快审核您的申诉，处理结果将通过站内信通知您。
          </div>
        </div>
      );
    }

    // User already has an appeal
    if (existingAppeal) {
      const statusInfo = STATUS_LABELS[existingAppeal.status] || { label: existingAppeal.status, cls: 'bg-secondary' };
      return (
        <>
          <div className="mb-3">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="fw-semibold small">申诉状态</span>
              <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>
            </div>
            <div className="small text-muted mb-1">
              封禁类型：{BAN_TYPE_LABELS[existingAppeal.ban_type] || existingAppeal.ban_type}
            </div>
            <div className="small text-muted mb-1">
              提交时间：{new Date(existingAppeal.created_at).toLocaleString()}
            </div>
          </div>
          <div className="mb-3">
            <div className="fw-semibold small mb-1">您的申诉理由</div>
            <div
              className="border rounded p-2 small bg-light"
              style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}
            >
              {existingAppeal.reason}
            </div>
          </div>
          {existingAppeal.admin_reply && (
            <div className="mb-2">
              <div className="fw-semibold small mb-1">管理员回复</div>
              <div
                className="border rounded p-2 small bg-light"
                style={{ whiteSpace: 'pre-wrap', maxHeight: 100, overflowY: 'auto' }}
              >
                {existingAppeal.admin_reply}
              </div>
            </div>
          )}
          {existingAppeal.status === 'pending' && (
            <div className="alert alert-info small py-2 mb-0">
              您的申诉正在审核中，请耐心等待。
            </div>
          )}
        </>
      );
    }

    // No existing appeal — show submission form
    return (
      <>
        <p className="small text-muted mb-3">
          请详细说明您认为封禁有误的原因。管理员将审核您的申诉，并通过站内信告知结果。
        </p>
        <div className="mb-3">
          <label className="form-label fw-semibold">申诉理由 <span className="text-danger">*</span></label>
          <textarea
            className={`form-control ${error ? 'is-invalid' : ''}`}
            rows={5}
            maxLength={2000}
            placeholder="请详细描述您的申诉理由……"
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(''); }}
            disabled={submitting}
          />
          <div className="d-flex justify-content-between mt-1">
            {error
              ? <div className="invalid-feedback d-block">{error}</div>
              : <div />}
            <div className="text-muted small">{reason.length}/2000</div>
          </div>
        </div>
      </>
    );
  };

  const showSubmitButton = existingAppeal === null && !submitted;

  return (
    <div
      className="modal d-block"
      tabIndex="-1"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-megaphone me-2" />
              提交封禁申诉
            </h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">{renderBody()}</div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              {submitted ? '关闭' : '取消'}
            </button>
            {showSubmitButton && (
              <button
                className="btn btn-danger"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <><span className="spinner-border spinner-border-sm me-1" />提交中…</>
                  : '提交申诉'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
