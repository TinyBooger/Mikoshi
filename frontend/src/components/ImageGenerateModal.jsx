import React, { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from './ToastProvider';
import { AuthContext } from './AuthProvider';
import { getApiErrorMessage } from '../utils/apiErrorUtils';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

// qwen-image-3.0 accepts these aspect ratios freely (total pixels stay within
// its 512x512-2048x2048 budget); qwen-image-max / qwen-image-plus accept them as
// their fixed preset list.
const SIZE_OPTIONS = [
  { value: '1328*1328', label: '1:1', hint: '方形' },
  { value: '1104*1472', label: '3:4', hint: '竖版' },
  { value: '1472*1104', label: '4:3', hint: '横版' },
  { value: '928*1664', label: '9:16', hint: '竖长' },
  { value: '1664*928', label: '16:9', hint: '横长' },
];

const MAX_PROMPT_LENGTH = 800;
const MAX_NEGATIVE_PROMPT_LENGTH = 500;

// Recommended negative prompt, taken verbatim from the Aliyun/DashScope
// Qwen-Image reference docs.
//
// This is the only definition in the codebase — the backend deliberately applies
// no default of its own, so the text shown in the textarea is exactly the text
// sent with the request.
const DEFAULT_NEGATIVE_PROMPT =
  '低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有AI感。构图混乱。文字模糊，扭曲。';

// Credits billed per generation. Display-only: the server is authoritative on
// the amount actually charged (IMAGE_GENERATION_CREDIT_COST in
// backend/routes/image_generation.py). Keep the two in sync for display accuracy.
const IMAGE_CREDIT_COST = 200;

/**
 * Character image generation modal (Aliyun Bailian / Qwen-Image).
 *
 * Props:
 *   show          - whether the modal is visible
 *   onClose       - close handler
 *   onGenerated   - ({ file, dataUrl, size }) => void, called with the chosen result
 *   defaultPrompt - prompt pre-filled when the modal opens
 */
export default function ImageGenerateModal({ show, onClose, onGenerated, defaultPrompt = '' }) {
  const toast = useToast();
  const { sessionToken } = useContext(AuthContext);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [size, setSize] = useState(SIZE_OPTIONS[0].value);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [useNegativePrompt, setUseNegativePrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [resultUrl, setResultUrl] = useState(null);

  // Reset the form every time the modal is opened.
  useEffect(() => {
    if (!show) return;
    setPrompt(defaultPrompt || '');
    setSize(SIZE_OPTIONS[0].value);
    setNegativePrompt('');
    setUseNegativePrompt(false);
    setLoading(false);
    setResultUrl(null);
  }, [show, defaultPrompt]);

  // Generation takes 10-30s; show elapsed seconds so it doesn't look frozen.
  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (!show) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [show, loading, onClose]);

  if (!show) return null;

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.show('请输入图片描述', { type: 'error' });
      return;
    }
    setLoading(true);
    setResultUrl(null);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken,
        },
        body: JSON.stringify({
          prompt: trimmed,
          size,
          // Unchecked -> explicitly empty, i.e. no negative prompt at all.
          // Checked   -> whatever the textarea holds (pre-filled with the default).
          negative_prompt: useNegativePrompt ? negativePrompt.trim() : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403 && data?.detail === 'UPLOAD_BANNED') {
          toast.show('你的账号已被限制上传内容，暂时无法生成图片。', { type: 'error' });
          return;
        }
        // Credit failures return a machine-readable `error` code like the chat
        // endpoint does. The backend message for the daily/monthly cap is
        // English, so it is not shown directly here.
        if (data?.error === 'CREDIT_CAP_REACHED') {
          toast.show(data.message || '已达到点数上限，暂时无法生成图片。', { type: 'error' });
          return;
        }
        if (data?.error === 'INSUFFICIENT_WALLET_CREDITS') {
          toast.show(data.message || '钱包点数不足，请充值后再试。', { type: 'error' });
          return;
        }
        toast.show(getApiErrorMessage(data, '图片生成失败，请稍后重试。'), { type: 'error' });
        return;
      }
      if (!data.image) {
        toast.show('图片生成失败，请稍后重试。', { type: 'error' });
        return;
      }
      setResultUrl(data.image);
      if (data.credit_amount > 0) {
        toast.show(`已消耗 ${data.credit_amount} 点数`, { type: 'info', duration: 4000 });
      }
    } catch (err) {
      console.error('Image generation failed', err);
      toast.show('网络错误，图片生成失败。', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUseResult = async () => {
    if (!resultUrl) return;
    try {
      const blob = await (await fetch(resultUrl)).blob();
      const mime = blob.type || 'image/png';
      const ext = mime.includes('jpeg') ? 'jpg' : (mime.split('/')[1] || 'png');
      const file = new File([blob], `ai_generated_${Date.now()}.${ext}`, { type: mime });
      onGenerated({ file, dataUrl: resultUrl, size });
      onClose();
    } catch (err) {
      console.error('Failed to use generated image', err);
      toast.show('图片处理失败，请重试。', { type: 'error' });
    }
  };

  // Rendered into document.body so the dialog escapes any transformed/overflow
  // clipping ancestor (e.g. the animated page wrappers). No Bootstrap `.modal`
  // class here: it sets `display: none` while `.d-block`'s `!important` would
  // override the inline flex below, and its descendants read padding from CSS
  // variables defined only on `.modal`.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI 生成角色图片"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        overflowY: 'auto',
        padding: '20px 12px',
      }}
    >
      {/* `margin: auto` centres on both axes and, unlike `align-items: center`,
          stays scrollable instead of clipping the top when the card overflows. */}
      <div style={{ margin: 'auto', width: '100%', maxWidth: 640 }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '1rem 1.15rem',
              borderBottom: '1px solid #eef0f3',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#232323' }}>
              <i className="bi bi-stars" style={{ color: '#736B92', marginRight: 8 }}></i>
              AI 生成角色图片
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
              aria-label="关闭"
            ></button>
          </div>

          <div style={{ padding: '1rem 1.15rem', maxHeight: '70vh', overflowY: 'auto' }}>
            <label className="form-label fw-semibold" style={{ fontSize: '0.92rem' }}>
              图片描述
            </label>
            <textarea
              className="form-control"
              rows={4}
              value={prompt}
              maxLength={MAX_PROMPT_LENGTH}
              placeholder="例如：一位银发少女站在樱花树下，和风服饰，柔和逆光，精致立绘"
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              style={{ fontSize: '0.92rem', resize: 'vertical' }}
            />
            <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: 4, textAlign: 'right' }}>
              {prompt.length} / {MAX_PROMPT_LENGTH}
            </div>

            <div className="fw-semibold" style={{ fontSize: '0.92rem', marginTop: 12, marginBottom: 6 }}>
              图片比例
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SIZE_OPTIONS.map((option) => {
                const active = size === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSize(option.value)}
                    disabled={loading}
                    style={{
                      border: active ? '2px solid #736B92' : '1px solid #e0e0e0',
                      background: active ? 'rgba(115, 107, 146, 0.08)' : '#fff',
                      color: '#232323',
                      borderRadius: 10,
                      padding: '0.35rem 0.8rem',
                      fontSize: '0.86rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      lineHeight: 1.3,
                    }}
                  >
                    <div className="fw-semibold">{option.label}</div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{option.hint}</div>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 16,
                padding: '0.75rem 0.9rem',
                border: `1px solid ${useNegativePrompt ? '#c9c2e0' : '#eef0f3'}`,
                borderRadius: 12,
                background: useNegativePrompt ? 'rgba(115, 107, 146, 0.05)' : '#fafbfc',
              }}
            >
              <div className="form-check" style={{ margin: 0, minHeight: 0 }}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="ai-custom-negative-prompt"
                  checked={useNegativePrompt}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setUseNegativePrompt(next);
                    // Seed the field with the recommended default on the first
                    // check; afterwards leave whatever the user typed alone.
                    if (next && !negativePrompt) setNegativePrompt(DEFAULT_NEGATIVE_PROMPT);
                  }}
                  disabled={loading}
                  style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                />
                <label
                  className="form-check-label fw-semibold"
                  htmlFor="ai-custom-negative-prompt"
                  style={{
                    fontSize: '0.9rem',
                    color: '#232323',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  负面提示词
                </label>
              </div>

              {useNegativePrompt && (
                <div style={{ marginTop: 10 }}>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={negativePrompt}
                    maxLength={MAX_NEGATIVE_PROMPT_LENGTH}
                    placeholder="例如：低分辨率，模糊，多余的手指，扭曲的脸"
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    disabled={loading}
                    style={{ fontSize: '0.88rem', resize: 'vertical' }}
                  />
                  <div
                    className="text-muted"
                    style={{ fontSize: '0.75rem', marginTop: 4, textAlign: 'right' }}
                  >
                    {negativePrompt.length} / {MAX_NEGATIVE_PROMPT_LENGTH}
                  </div>
                </div>
              )}
            </div>

            {loading && (
              <div style={{ marginTop: 16, textAlign: 'center', color: '#4b5563', fontSize: '0.9rem' }}>
                <div className="spinner-border spinner-border-sm" role="status" style={{ marginRight: 8 }}></div>
                正在生成，通常需要 10-30 秒...{elapsed > 0 ? `（${elapsed}s）` : ''}
              </div>
            )}

            {resultUrl && !loading && (
              <div style={{ marginTop: 16 }}>
                <div className="fw-semibold" style={{ fontSize: '0.92rem', marginBottom: 6 }}>生成结果</div>
                <img
                  src={resultUrl}
                  alt="生成结果"
                  style={{
                    width: '100%',
                    maxHeight: 360,
                    objectFit: 'contain',
                    background: '#f5f6fa',
                    border: '1px solid #e9ecef',
                    borderRadius: 12,
                  }}
                />
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '0.9rem 1.15rem',
              borderTop: '1px solid #eef0f3',
              background: '#fafbfc',
            }}
          >
            {/* `marginRight: auto` pins this to the left while the buttons stay
                right-aligned. Shown before generating so the cost is never a
                surprise; hidden once a result exists to keep it uncluttered. */}
            {!resultUrl && !loading && (
              <span className="text-muted" style={{ fontSize: '0.78rem', marginRight: 'auto' }}>
                每次生成消耗 {IMAGE_CREDIT_COST} 点数
              </span>
            )}
            <SecondaryButton onClick={onClose} disabled={loading}>
              取消
            </SecondaryButton>
            {resultUrl ? (
              <>
                <SecondaryButton onClick={handleGenerate} disabled={loading}>
                  重新生成（{IMAGE_CREDIT_COST} 点数）
                </SecondaryButton>
                <PrimaryButton onClick={handleUseResult}>使用这张图片</PrimaryButton>
              </>
            ) : (
              <PrimaryButton onClick={handleGenerate} disabled={loading}>
                {loading ? '生成中...' : `生成图片（${IMAGE_CREDIT_COST} 点数）`}
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
