import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ShareCard from './ShareCard';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import { useToast } from '../ToastProvider';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  buildSharePayload,
  DEFAULT_SHARE_MESSAGE_COUNT,
  MAX_SHARE_MESSAGES,
  resolveMediaUrl,
} from '../../utils/shareData';
import {
  DEFAULT_BACKGROUND_ID,
  DEFAULT_TEMPLATE_ID,
  SHARE_TEMPLATES,
  getShareTemplate,
  getShareBackground,
  getAvailableBackgrounds,
  getDefaultTemplateId,
  resolveShareBackgroundId,
} from './shareTemplates';
import {
  captureShareCard,
  canvasToPngBlob,
  buildShareFilename,
  saveImageBlob,
  copyImageBlobToClipboard,
} from '../../utils/shareImage';
// Same-origin fallbacks, mirroring the avatars the card paints.
import fallbackCharacterAvatar from '../../assets/images/default-picture.png';
import fallbackUserAvatar from '../../assets/images/default-avatar.png';

/**
 * "制作截图" dialog.
 *
 * Owns the whole share-card flow: pick which messages to include, pick a
 * template + background, preview the exact card that will be exported, then
 * download / copy / share it as a PNG.
 *
 * The preview IS the export: a full-size `<ShareCard>` is laid out off-screen at
 * 1080px, rasterised with html2canvas, and the resulting PNG blob is shown in a
 * real `<img>`. It is therefore a normal image on the page — right-clickable,
 * draggable, selectable — and not a CSS-scaled DOM copy that merely approximates
 * what the export will look like.
 */

/** The preview box is a fixed viewport the captured PNG is fitted into. */
const PREVIEW_BOX_HEIGHT_DESKTOP = '60vh';
const PREVIEW_BOX_HEIGHT_MOBILE = '46vh';

/**
 * Wait this long after the last change before rasterising. Clicking through
 * several messages/backgrounds in a row then costs one html2canvas run instead
 * of one per click.
 */
const PREVIEW_RENDER_DEBOUNCE_MS = 200;

export default function ShareScreenshotDialog({
  show,
  onClose,
  messages,
  character,
  scene,
  persona,
  userData,
  wallpaperUrl,
  // Raw wallpaper state id (a preset id, 'custom_upload', 'character_picture',
  // ...). `wallpaperUrl` alone cannot distinguish a gradient from 'none'.
  wallpaperId,
  // Advanced chat config's `interface_preference`; decides the starter layout.
  interfacePreference,
}) {
  const toast = useToast();
  const isMobile = useIsMobile();

  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [backgroundId, setBackgroundId] = useState(DEFAULT_BACKGROUND_ID);
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(null);
  // Object URL of the rendered PNG. The preview shows this, and the copy/save
  // actions reuse its blob whenever it is up to date.
  const [previewUrl, setPreviewUrl] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const captureRef = useRef(null);
  const previewUrlRef = useRef(null);
  const previewBlobRef = useRef(null);
  // Only the newest render may publish its result: a debounced render can be
  // superseded by another option change while html2canvas is still working.
  const renderTokenRef = useRef(0);
  // html2canvas runs are chained so an export capture never overlaps a preview
  // capture of the same node (they would race their own temporary DOM clones).
  const captureQueueRef = useRef(Promise.resolve());

  const payload = useMemo(
    () => buildSharePayload({ character, scene, persona, userData, messages }),
    [character, scene, persona, userData, messages],
  );

  // The `character-art` background is painted full-bleed, so it wants the
  // portrait (立绘) rather than the small avatar crop.
  const characterImageUrl = useMemo(() => {
    const entity = scene || character;
    return resolveMediaUrl(entity?.picture) || resolveMediaUrl(entity?.avatar_picture);
  }, [character, scene]);

  const availableBackgrounds = useMemo(
    () => getAvailableBackgrounds({ characterImageUrl, wallpaperUrl: wallpaperUrl || null }),
    [characterImageUrl, wallpaperUrl],
  );

  // What the dialog should open on, mirroring the live conversation. Both are
  // re-applied on every open, so switching chats re-seeds instead of keeping
  // whatever the user picked last time.
  const chatTemplateId = getDefaultTemplateId(interfacePreference);
  const chatBackgroundId = useMemo(
    () => resolveShareBackgroundId({
      wallpaperId,
      characterImageUrl,
      wallpaperUrl: wallpaperUrl || null,
    }),
    [wallpaperId, characterImageUrl, wallpaperUrl],
  );

  const template = getShareTemplate(templateId);

  // Keep the chosen background usable when the conversation changes (e.g. a
  // character with no artwork is opened after one that had some).
  const background = useMemo(() => {
    const found = availableBackgrounds.find((bg) => bg.id === backgroundId);
    return found || availableBackgrounds.find((bg) => bg.id === DEFAULT_BACKGROUND_ID) || availableBackgrounds[0];
  }, [availableBackgrounds, backgroundId]);

  const selectedLines = useMemo(() => {
    const wanted = new Set(selectedIds);
    return payload.lines.filter((line) => wanted.has(line.id));
  }, [payload, selectedIds]);

  const capturePayload = useMemo(
    () => ({ ...payload, lines: selectedLines }),
    [payload, selectedLines],
  );

  // Content fingerprint of the card, kept as a *string* on purpose: the parent
  // hands down a fresh `messages` array on every streaming chunk, so comparing
  // object identities would invalidate a perfectly good preview on every render
  // and re-rasterise forever. A string only changes when the card really changes.
  const renderKey = useMemo(
    () => JSON.stringify([
      template.id,
      background?.id || '',
      background?.imageUrl || '',
      // `created_at` is part of the card: it decides the time dividers.
      capturePayload.lines.map((line) => [line.id, line.avatar || '', line.created_at || '', line.text]),
    ]),
    [template, background, capturePayload],
  );

  const atLimit = selectedIds.length >= MAX_SHARE_MESSAGES;

  // Initial state = the current chat: most recent messages selected, plus the
  // chat's own layout and background. Applied only when the dialog opens so a
  // mid-stream re-render never clobbers the user's own choices. Read through
  // refs because the effect deliberately depends on `show` alone.
  const wasOpenRef = useRef(false);
  const linesRef = useRef([]);
  linesRef.current = payload.lines;
  const openDefaultsRef = useRef({ templateId: DEFAULT_TEMPLATE_ID, backgroundId: DEFAULT_BACKGROUND_ID });
  openDefaultsRef.current = { templateId: chatTemplateId, backgroundId: chatBackgroundId };
  useEffect(() => {
    if (show && !wasOpenRef.current) {
      setSelectedIds(linesRef.current.slice(-DEFAULT_SHARE_MESSAGE_COUNT).map((line) => line.id));
      setTemplateId(openDefaultsRef.current.templateId);
      setBackgroundId(openDefaultsRef.current.backgroundId);
      setBusy(null);
      setZoomed(false);
    }
    wasOpenRef.current = show;
  }, [show]);

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

  // Drop the rendered PNG and invalidate any capture still in flight so it
  // cannot publish into the freshly-cleared state.
  const clearPreview = useCallback(() => {
    renderTokenRef.current += 1;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    previewBlobRef.current = null;
    setPreviewUrl(null);
    setRendering(false);
    setRenderError(false);
  }, []);

  const runCapture = useCallback(() => {
    const task = captureQueueRef.current.then(() => captureShareCard(captureRef.current));
    // Keep the chain alive even when this capture rejects.
    captureQueueRef.current = task.then(() => {}, () => {});
    return task;
  }, []);

  // Rasterise the off-screen card and publish the PNG. Everything the user sees
  // in the preview box comes from here.
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
      // Leave any previous image on screen and offer a retry instead of a toast:
      // an auto-render failure would otherwise pop up on every option change.
      if (token === renderTokenRef.current) setRenderError(true);
    } finally {
      if (token === renderTokenRef.current) setRendering(false);
    }
  }, [runCapture]);

  // Free the blob URL while the dialog is closed, so reopening always
  // rasterises the current conversation instead of flashing the last one.
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

  // Re-rasterise whenever the card's content changes. Debounced, so picking the
  // messages and the look costs a single capture rather than one per click.
  useEffect(() => {
    if (!show) return undefined;
    if (selectedLines.length === 0) {
      clearPreview();
      return undefined;
    }
    const timer = setTimeout(renderPreview, PREVIEW_RENDER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [show, renderKey, selectedLines.length, renderPreview, clearPreview]);

  const toggleLine = useCallback((id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((value) => value !== id);
      if (prev.length >= MAX_SHARE_MESSAGES) return prev;
      return [...prev, id];
    });
  }, []);

  const selectAll = () => setSelectedIds(payload.lines.slice(-MAX_SHARE_MESSAGES).map((l) => l.id));
  const clearAll = () => setSelectedIds([]);

  const handleExport = useCallback(
    async (mode) => {
      if (selectedLines.length === 0) {
        toast.show('请至少选择一条消息', { type: 'info' });
        return;
      }
      setBusy(mode);
      try {
        // Reuse the PNG already on screen when it is up to date, so what gets
        // copied or saved is exactly the image the user just looked at. Only a
        // pending/failed render forces a fresh capture.
        let blob = !rendering && !renderError ? previewBlobRef.current : null;
        if (!blob) {
          const canvas = await runCapture();
          blob = await canvasToPngBlob(canvas);
        }
        const filename = buildShareFilename(payload.characterName);

        if (mode === 'copy') {
          const copied = await copyImageBlobToClipboard(blob);
          if (copied) toast.show('截图已复制到剪贴板', { type: 'success' });
          else toast.show('当前浏览器不支持复制图片，请改用保存图片', { type: 'error' });
          return;
        }

        // Saving goes through the OS "save as" dialog where possible.
        const result = await saveImageBlob(blob, filename);
        if (result === 'saved') toast.show('截图已保存', { type: 'success' });
        else if (result === 'downloaded') toast.show('截图已下载到本地', { type: 'success' });
      } catch (error) {
        toast.show('生成截图失败，请重试', { type: 'error' });
      } finally {
        setBusy(null);
      }
    },
    [selectedLines.length, payload.characterName, rendering, renderError, runCapture, toast],
  );

  if (!show) return null;

  const nonSystemCount = payload.lines.length;

  return createPortal(
    <>
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
        <ShareCard
          ref={captureRef}
          payload={capturePayload}
          template={template}
          background={background}
          backgroundImageUrl={background.imageUrl}
        />
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="制作分享截图"
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
            maxWidth: isMobile ? 560 : 1120,
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
              <i className="bi bi-camera" style={{ color: '#736B92', marginRight: 8 }}></i>
              制作分享截图
            </div>
            <button type="button" className="btn-close" onClick={onClose} aria-label="关闭"></button>
          </div>

          {/* Body */}
          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 16,
              padding: '1rem 1.15rem',
              maxHeight: isMobile ? 'none' : '78vh',
              overflowY: isMobile ? 'visible' : 'auto',
              minHeight: 0,
            }}
          >
            {/* Controls */}
            <div style={{ width: isMobile ? '100%' : 340, flexShrink: 0, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#232323' }}>
                  选择消息
                  <span style={{ marginLeft: 8, fontSize: '0.78rem', color: '#8b8b93', fontWeight: 600 }}>
                    {selectedIds.length}/{MAX_SHARE_MESSAGES}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={selectAll}
                    style={linkButtonStyle}
                  >
                    全选
                  </button>
                  <button type="button" onClick={clearAll} style={linkButtonStyle}>
                    清空
                  </button>
                </span>
              </div>

              {nonSystemCount === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#8b8b93', padding: '1rem 0' }}>
                  当前对话还没有可以分享的消息。
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxHeight: isMobile ? 200 : 260,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {payload.lines.map((line, index) => {
                    const selected = selectedIds.includes(line.id);
                    return (
                      <button
                        key={line.id}
                        type="button"
                        onClick={() => toggleLine(line.id)}
                        disabled={!selected && atLimit}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          textAlign: 'left',
                          padding: '7px 9px',
                          borderRadius: 10,
                          cursor: !selected && atLimit ? 'not-allowed' : 'pointer',
                          background: selected ? 'rgba(115, 107, 146, 0.1)' : '#fff',
                          border: `1px solid ${selected ? 'rgba(115, 107, 146, 0.45)' : '#eceef2'}`,
                          opacity: !selected && atLimit ? 0.5 : 1,
                        }}
                      >
                        <i
                          className={`bi ${selected ? 'bi-check-square-fill' : 'bi-square'}`}
                          style={{
                            color: selected ? '#736B92' : '#c4c7cf',
                            fontSize: '0.95rem',
                            marginTop: 2,
                            flexShrink: 0,
                          }}
                        ></i>
                        {/* A background instead of an <img>: a failed load then
                            shows the fallback art rather than a broken icon. */}
                        <span
                          aria-hidden="true"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            flexShrink: 0,
                            marginTop: 1,
                            background: `#f1f0f6 url(${
                              line.avatar || (line.role === 'user' ? fallbackUserAvatar : fallbackCharacterAvatar)
                            }) center/cover no-repeat`,
                            border: `1px solid ${
                              line.role === 'user' ? 'rgba(37, 99, 235, 0.35)' : 'rgba(115, 107, 146, 0.35)'
                            }`,
                          }}
                        />
                        <span style={{ minWidth: 0, display: 'block' }}>
                          <span
                            style={{
                              display: 'block',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: line.role === 'user' ? '#2563eb' : '#736B92',
                            }}
                          >
                            {line.author}
                            <span style={{ marginLeft: 6, color: '#b0b3bb', fontWeight: 600 }}>
                              #{index + 1}
                            </span>
                          </span>
                          <span
                            style={{
                              display: 'block',
                              fontSize: '0.78rem',
                              color: '#4b5563',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {line.preview}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {atLimit ? (
                <div style={{ marginTop: 8, fontSize: '0.74rem', color: '#b45309' }}>
                  最多选择 {MAX_SHARE_MESSAGES} 条消息，取消已选中的消息即可更换。
                </div>
              ) : null}

              {/* Template picker */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#232323', marginBottom: 8 }}>
                  样式
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  {SHARE_TEMPLATES.map((item) => {
                    const active = item.id === template.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTemplateId(item.id)}
                        style={{
                          padding: '8px 0',
                          borderRadius: 10,
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          background: active ? 'rgba(115, 107, 146, 0.12)' : '#fff',
                          border: `1px solid ${active ? 'rgba(115, 107, 146, 0.55)' : '#e5e7eb'}`,
                          color: active ? '#5f567f' : '#4b5563',
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background picker */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#232323', marginBottom: 8 }}>
                  背景
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  {availableBackgrounds.map((item) => {
                    const active = item.id === background.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setBackgroundId(item.id)}
                        title={item.label}
                        style={{
                          padding: 5,
                          borderRadius: 10,
                          cursor: 'pointer',
                          background: '#fff',
                          border: `2px solid ${active ? '#736B92' : '#e5e7eb'}`,
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            height: 46,
                            borderRadius: 6,
                            border: '1px solid rgba(0,0,0,0.06)',
                            background: item.kind === 'image'
                              ? `#1a1730 url(${item.imageUrl}) center/cover no-repeat`
                              : item.css,
                          }}
                        />
                        <span
                          style={{
                            display: 'block',
                            marginTop: 4,
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: '#4b5563',
                          }}
                        >
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
                aria-label={previewUrl ? '放大预览截图' : undefined}
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
                {/* The preview is the exported PNG itself, as a real <img> —
                    right-click / drag / copy behave like any other image. */}
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="分享截图预览"
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
                    {selectedLines.length === 0
                      ? '请至少选择一条消息'
                      : renderError
                        ? '预览生成失败'
                        : '正在生成预览…'}
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
              已选择 {selectedLines.length} 条消息
            </span>
            <SecondaryButton isMobile={isMobile} onClick={onClose} disabled={!!busy}>
              取消
            </SecondaryButton>
            <SecondaryButton
              isMobile={isMobile}
              onClick={() => handleExport('copy')}
              disabled={!!busy || selectedLines.length === 0}
            >
              {busy === 'copy' ? '处理中…' : '复制图片'}
            </SecondaryButton>
            <PrimaryButton
              isMobile={isMobile}
              onClick={() => handleExport('save')}
              disabled={!!busy || selectedLines.length === 0}
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
          aria-label="截图大图预览"
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
            alt="分享截图预览"
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

const linkButtonStyle = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  fontSize: '0.76rem',
  fontWeight: 700,
  color: '#736B92',
  cursor: 'pointer',
};
