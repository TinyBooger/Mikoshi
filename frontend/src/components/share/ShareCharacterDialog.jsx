import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CharacterShareCard, { CHARACTER_CARD_PRESETS } from './CharacterShareCard';
import CharacterQrCode from './CharacterQrCode';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import { useToast } from '../ToastProvider';
import { useIsMobile } from '../../hooks/useIsMobile';
import { buildCharacterSharePayload } from '../../utils/shareData';
import {
  captureShareCard,
  canvasToPngBlob,
  buildShareFilename,
  saveImageBlob,
  copyImageBlobToClipboard,
} from '../../utils/shareImage';

/**
 * "分享角色卡片" dialog.
 *
 * The character-card counterpart to `ShareScreenshotDialog`, and deliberately
 * the same shape: a full-size `<CharacterShareCard>` is laid out off-screen at
 * 1080px, rasterised with html2canvas, and the resulting PNG is shown in a real
 * `<img>` — so the preview IS the export, right-clickable and draggable.
 *
 * What it does not have is the message dialog's message picker: a character card
 * has no transcript. It does keep one choice, mirroring the background picker —
 * `铺满背景` paints the artwork behind the copy, `完整图片` stages it whole.
 */

/** The preview box is a fixed viewport the captured PNG is fitted into. */
const PREVIEW_BOX_HEIGHT_DESKTOP = '60vh';
const PREVIEW_BOX_HEIGHT_MOBILE = '46vh';

/** Wait this long after the last change before rasterising. */
const PREVIEW_RENDER_DEBOUNCE_MS = 200;

export default function ShareCharacterDialog({ show, onClose, entity, type, id }) {
  const toast = useToast();
  const isMobile = useIsMobile();

  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [preset, setPreset] = useState(CHARACTER_CARD_PRESETS[0].id);
  const [busy, setBusy] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const captureRef = useRef(null);
  const previewUrlRef = useRef(null);
  const previewBlobRef = useRef(null);
  const renderTokenRef = useRef(0);
  // html2canvas runs are chained so an export capture never overlaps a preview
  // capture of the same node (they would race their own temporary DOM clones).
  const captureQueueRef = useRef(Promise.resolve());

  const payload = useMemo(
    () => buildCharacterSharePayload({ entity, type, id }),
    [entity, type, id],
  );

  // Content fingerprint. A string on purpose: the parent re-renders freely and
  // object identities would invalidate a perfectly good preview every time.
  const renderKey = useMemo(
    () => JSON.stringify([
      payload.url,
      payload.name,
      payload.tagline,
      payload.tags,
      payload.creatorName,
      payload.likes,
      payload.views,
      payload.portrait,
      payload.avatar,
      preset,
      qrDataUrl,
    ]),
    [payload, preset, qrDataUrl],
  );

  const clearPreview = useCallback(() => {
    renderTokenRef.current += 1;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    previewBlobRef.current = null;
    setPreviewUrl(null);
    setRendering(false);
    setRenderError(false);
  }, []);

  // A fresh QR for every open: the target URL follows `type`/`id`, and dropping
  // it keeps a previously generated code from flashing on screen. `zoomed` is
  // reset too, so a dialog closed from the zoom view reopens at its normal size.
  useEffect(() => {
    if (!show) {
      setQrDataUrl(null);
      setZoomed(false);
    }
  }, [show]);

  // Free the blob URL while the dialog is closed, so reopening always
  // rasterises the current entity instead of flashing the last one.
  useEffect(() => {
    if (!show) clearPreview();
  }, [show, clearPreview]);

  // The blob URL lives outside React's lifecycle — release it on unmount.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  // Escape backs out one layer at a time: the zoom view first, then the dialog.
  useEffect(() => {
    if (!show) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (zoomed) {
        setZoomed(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [show, onClose, zoomed]);

  const runCapture = useCallback(() => {
    const task = captureQueueRef.current.then(() => captureShareCard(captureRef.current));
    // Keep the chain alive even when this capture rejects.
    captureQueueRef.current = task.then(() => {}, () => {});
    return task;
  }, []);

  const renderPreview = useCallback(async () => {
    const token = renderTokenRef.current + 1;
    renderTokenRef.current = token;
    setRendering(true);
    try {
      const canvas = await runCapture();
      const blob = await canvasToPngBlob(canvas);
      if (token !== renderTokenRef.current) return;
      const url = URL.createObjectURL(blob);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      previewBlobRef.current = blob;
      setPreviewUrl(url);
      setRenderError(false);
    } catch {
      // Offer a retry instead of a toast: an auto-render failure would otherwise
      // pop up the moment the dialog opens.
      if (token === renderTokenRef.current) setRenderError(true);
    } finally {
      if (token === renderTokenRef.current) setRendering(false);
    }
  }, [runCapture]);

  // Re-rasterise whenever the card's content changes — which, in practice, is
  // once on open and once more when the QR image resolves.
  useEffect(() => {
    if (!show) return undefined;
    const timer = setTimeout(renderPreview, PREVIEW_RENDER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [show, renderKey, renderPreview]);

  const handleExport = useCallback(
    async (mode) => {
      setBusy(mode);
      try {
        // Reuse the PNG already on screen when it is up to date, so what gets
        // copied or saved is exactly the image the user just looked at.
        let blob = !rendering && !renderError ? previewBlobRef.current : null;
        if (!blob) {
          const canvas = await runCapture();
          blob = await canvasToPngBlob(canvas);
        }
        const filename = buildShareFilename(payload.name);

        if (mode === 'copy') {
          const copied = await copyImageBlobToClipboard(blob);
          if (copied) toast.show('角色卡片已复制到剪贴板', { type: 'success' });
          else toast.show('当前浏览器不支持复制图片，请改用保存图片', { type: 'error' });
          return;
        }

        const result = await saveImageBlob(blob, filename);
        if (result === 'saved') toast.show('角色卡片已保存', { type: 'success' });
        else if (result === 'downloaded') toast.show('角色卡片已下载到本地', { type: 'success' });
      } catch {
        toast.show('生成角色卡片失败，请重试', { type: 'error' });
      } finally {
        setBusy(null);
      }
    },
    [rendering, renderError, runCapture, payload.name, toast],
  );

  if (!show || !entity) return null;

  return createPortal(
    <>
      {/* QR generator: paints off-screen, hands the card a PNG data URL. Must
          stay outside the capture node, or html2canvas would paint the raw SVG
          twice. */}
      {payload.url ? (
        <CharacterQrCode value={payload.url} onReady={setQrDataUrl} />
      ) : null}

      {/* Full-size render target handed to html2canvas. Clipped to a zero-size
          box so it never paints, but still laid out at its natural size. */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <CharacterShareCard
          ref={captureRef}
          payload={payload}
          qrDataUrl={qrDataUrl}
          preset={preset}
        />
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="分享角色卡片"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          overflowY: 'auto',
          padding: isMobile ? '12px 8px' : '20px 12px',
        }}
      >
        <div
          style={{
            margin: 'auto',
            width: '100%',
            maxWidth: isMobile ? 560 : 720,
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
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
              <i className="bi bi-share" style={{ color: '#736B92', marginRight: 8 }}></i>
              分享角色卡片
            </div>
            <button type="button" className="btn-close" onClick={onClose} aria-label="关闭"></button>
          </div>

          {/* Body */}
          <div style={{ padding: '1rem 1.15rem' }}>
            {/* Only meaningful when there is artwork to lay out; the card itself
                falls back to the same plain surface for both presets. */}
            {payload.portrait ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#232323' }}>样式</span>
                <div
                  role="group"
                  aria-label="卡片样式"
                  style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 999, background: '#f1f0f5' }}
                >
                  {CHARACTER_CARD_PRESETS.map((option) => {
                    const active = option.id === preset;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        disabled={!!busy}
                        onClick={() => setPreset(option.id)}
                        style={{
                          border: 'none',
                          borderRadius: 999,
                          padding: '6px 14px',
                          fontSize: '0.78rem',
                          fontWeight: active ? 700 : 600,
                          cursor: busy ? 'default' : 'pointer',
                          color: active ? '#fff' : '#5b5b66',
                          background: active ? '#736B92' : 'transparent',
                          transition: 'background 0.15s ease, color 0.15s ease',
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#232323' }}>预览</span>
              <span
                onClick={() => {
                  if (previewUrl) setZoomed(true);
                }}
                style={{
                  fontSize: '0.74rem',
                  color: previewUrl ? '#8b8b93' : '#c4c7cf',
                  cursor: previewUrl ? 'zoom-in' : 'default',
                }}
              >
                <i className="bi bi-arrows-fullscreen" style={{ marginRight: 4 }}></i>
                点击查看大图
              </span>
            </div>
            <div
              role={previewUrl ? 'button' : undefined}
              tabIndex={previewUrl ? 0 : undefined}
              aria-label={previewUrl ? '放大预览角色卡片' : undefined}
              title={previewUrl ? '点击查看大图' : undefined}
              onClick={() => {
                if (previewUrl) setZoomed(true);
              }}
              onKeyDown={(event) => {
                if (!previewUrl) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setZoomed(true);
                }
              }}
              style={{
                position: 'relative',
                width: '100%',
                height: isMobile ? PREVIEW_BOX_HEIGHT_MOBILE : PREVIEW_BOX_HEIGHT_DESKTOP,
                overflow: 'hidden',
                borderRadius: 12,
                border: '1px solid #eceef2',
                background: '#f6f6f8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: previewUrl ? 'zoom-in' : 'default',
              }}
            >
              {/* The preview is the exported PNG itself, as a real <img>. */}
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="角色卡片预览"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    display: 'block',
                    opacity: rendering ? 0.55 : 1,
                    transition: 'opacity 0.15s ease',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.14)',
                  }}
                />
              ) : (
                <span style={{ padding: 16, textAlign: 'center', fontSize: '0.82rem', color: '#8b8b93' }}>
                  {renderError ? '预览生成失败' : '正在生成预览…'}
                </span>
              )}

              {rendering && previewUrl ? (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'rgba(35, 35, 35, 0.72)',
                    color: '#fff',
                    fontSize: '0.72rem',
                    pointerEvents: 'none',
                  }}
                >
                  生成中…
                </span>
              ) : null}

              {renderError && previewUrl ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    renderPreview();
                  }}
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    border: 'none',
                    borderRadius: 999,
                    padding: '3px 12px',
                    background: '#736B92',
                    color: '#fff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  重新生成
                </button>
              ) : null}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              flexWrap: 'wrap',
              padding: '0.9rem 1.15rem',
              borderTop: '1px solid #eef0f3',
              background: '#fbfbfd',
            }}
          >
            <span style={{ marginRight: 'auto', fontSize: '0.78rem', color: '#8b8b93' }}>
              扫卡片上的二维码即可找到 {payload.name}
            </span>
            <SecondaryButton isMobile={isMobile} onClick={onClose} disabled={!!busy}>
              取消
            </SecondaryButton>
            <SecondaryButton
              isMobile={isMobile}
              onClick={() => handleExport('copy')}
              disabled={!!busy || !previewUrl}
            >
              {busy === 'copy' ? '处理中…' : '复制图片'}
            </SecondaryButton>
            <PrimaryButton
              isMobile={isMobile}
              onClick={() => handleExport('save')}
              disabled={!!busy || !previewUrl}
            >
              {busy === 'save' ? '生成中…' : '保存图片'}
            </PrimaryButton>
          </div>
        </div>
      </div>

      {/* Full-screen zoom. The same PNG, fitted to the viewport. */}
      {zoomed && previewUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="角色卡片大图预览"
          onClick={() => setZoomed(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100001,
            background: 'rgba(10, 8, 18, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: 'zoom-out',
            padding: 24,
          }}
        >
          <img
            src={previewUrl}
            alt="角色卡片预览"
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'block',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
            }}
          />

          <button
            type="button"
            className="btn-close btn-close-white"
            aria-label="关闭大图"
            onClick={(event) => {
              event.stopPropagation();
              setZoomed(false);
            }}
            style={{ position: 'absolute', top: 18, right: 18 }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.78rem',
              color: 'rgba(255, 255, 255, 0.7)',
              whiteSpace: 'nowrap',
            }}
          >
            按 Esc 或点击空白处返回
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
