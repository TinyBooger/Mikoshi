import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ShareCard from './ShareCard';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import { useToast } from '../ToastProvider';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  buildSharePayload,
  MAX_SHARE_MESSAGES,
  resolveMediaUrl,
} from '../../utils/shareData';
import {
  SHARE_CARD_WIDTH,
  SHARE_CARD_MIN_HEIGHT,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_TEMPLATE_ID,
  SHARE_TEMPLATES,
  getShareTemplate,
  getShareBackground,
  getAvailableBackgrounds,
} from './shareTemplates';
import {
  captureShareCard,
  canvasToPngBlob,
  buildShareFilename,
  downloadBlob,
  shareImageBlob,
  copyImageBlobToClipboard,
  canShareImageFile,
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
 * The preview and the export are the *same component*, so what the user sees is
 * what they get. Only the preview is CSS-scaled; the export node is rendered at
 * full size off-screen and handed to html2canvas untouched.
 */

/** The preview box is a fixed viewport the card is scaled to *contain*. */
const PREVIEW_BOX_HEIGHT_DESKTOP = '60vh';
const PREVIEW_BOX_HEIGHT_MOBILE = '46vh';

/** Breathing room kept around the card in the full-screen zoom view. */
const ZOOM_GUTTER = 48;

export default function ShareScreenshotDialog({
  show,
  onClose,
  messages,
  character,
  scene,
  persona,
  userData,
  wallpaperUrl,
}) {
  const toast = useToast();
  const isMobile = useIsMobile();

  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [backgroundId, setBackgroundId] = useState(DEFAULT_BACKGROUND_ID);
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(null);
  const [previewScale, setPreviewScale] = useState(0.36);
  const [cardHeight, setCardHeight] = useState(SHARE_CARD_MIN_HEIGHT);
  const [zoomed, setZoomed] = useState(false);
  // Seeded from the live window (like `useIsMobile`) so the very first zoom
  // frame is already correctly scaled instead of flashing a full-size card.
  const [zoomViewport, setZoomViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const captureRef = useRef(null);
  const previewCardRef = useRef(null);
  const previewBoxRef = useRef(null);
  // Read inside the ResizeObserver callback, which must not be re-created on
  // every height change just to see the latest value.
  const cardHeightRef = useRef(SHARE_CARD_MIN_HEIGHT);

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

  const atLimit = selectedIds.length >= MAX_SHARE_MESSAGES;
  const canShareNatively = useMemo(() => {
    try {
      return canShareImageFile(new File([new Blob(['1'])], 'share.png', { type: 'image/png' }));
    } catch {
      return false;
    }
  }, []);

  // Default selection = the most recent messages. Applied only when the dialog
  // opens so a mid-stream re-render never clobbers the user's own selection.
  const wasOpenRef = useRef(false);
  const linesRef = useRef([]);
  linesRef.current = payload.lines;
  useEffect(() => {
    if (show && !wasOpenRef.current) {
      setSelectedIds(linesRef.current.slice(-MAX_SHARE_MESSAGES).map((line) => line.id));
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

  // The preview is the full-size card scaled down. The card sizes itself to its
  // content (height) while the width is fixed, so the scale is the *smaller* of
  // the width and height ratios — the card is fitted to *contain* in the box,
  // which means the whole layout is visible at once instead of the box width
  // setting the scale and the overflow being scrolled.
  useEffect(() => {
    if (!show) return undefined;
    const card = previewCardRef.current;
    const box = previewBoxRef.current;
    if (!card || !box) return undefined;

    const sync = () => {
      const naturalHeight = card.offsetHeight || SHARE_CARD_MIN_HEIGHT;
      cardHeightRef.current = naturalHeight;
      setCardHeight(naturalHeight);

      const width = box.clientWidth;
      const height = box.clientHeight;
      if (width <= 0 || height <= 0) return;
      setPreviewScale(
        Math.min(1, width / SHARE_CARD_WIDTH, height / naturalHeight),
      );
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(card);
    observer.observe(box);
    return () => observer.disconnect();
  }, [show, template, background, capturePayload]);

  // Measure the viewport while the zoom view is open so the card can be scaled
  // to fill it without ever overflowing.
  useEffect(() => {
    if (!zoomed) return undefined;
    const update = () => setZoomViewport({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [zoomed]);

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
        const canvas = await captureShareCard(captureRef.current);
        const blob = await canvasToPngBlob(canvas);
        const filename = buildShareFilename(payload.characterName);

        if (mode === 'download') {
          downloadBlob(blob, filename);
          toast.show('截图已保存到本地', { type: 'success' });
        } else if (mode === 'copy') {
          const copied = await copyImageBlobToClipboard(blob);
          if (copied) toast.show('截图已复制到剪贴板', { type: 'success' });
          else toast.show('当前浏览器不支持复制图片，请改用下载', { type: 'error' });
        } else {
          const shared = await shareImageBlob(blob, filename, `${payload.characterName} · 语伴岛`);
          if (!shared) {
            downloadBlob(blob, filename);
            toast.show('截图已保存到本地', { type: 'success' });
          }
        }
      } catch (error) {
        // A cancelled OS share sheet is not a failure.
        if (error?.name !== 'AbortError') {
          toast.show('生成截图失败，请重试', { type: 'error' });
        }
      } finally {
        setBusy(null);
      }
    },
    [selectedLines.length, payload.characterName, toast],
  );

  if (!show) return null;

  const nonSystemCount = payload.lines.length;

  // Fill the viewport with the card, keeping a gutter so it never touches the
  // screen edges. `cardHeight` is the natural height measured by the preview.
  const zoomScale =
    zoomViewport.width > 0
      ? Math.min(
          1,
          (zoomViewport.width - ZOOM_GUTTER) / SHARE_CARD_WIDTH,
          (zoomViewport.height - ZOOM_GUTTER) / Math.max(cardHeight, 1),
        )
      : 1;

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
                            {line.text}
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
                  onClick={() => setZoomed(true)}
                  style={{ fontSize: '0.74rem', color: '#8b8b93', cursor: 'zoom-in' }}
                >
                  <i className="bi bi-arrows-fullscreen" style={{ marginRight: 4 }}></i>
                  点击查看大图
                </span>
              </div>
              <div
                ref={previewBoxRef}
                role="button"
                tabIndex={0}
                aria-label="放大预览截图"
                title="点击查看大图"
                onClick={() => setZoomed(true)}
                onKeyDown={(event) => {
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
                  cursor: 'zoom-in',
                }}
              >
                {/* The wrapper keeps its natural (unscaled) size so the card
                    lays out exactly as it will when exported; only the visual
                    is scaled, centred on the wrapper's own centre. */}
                <div
                  style={{
                    width: SHARE_CARD_WIDTH,
                    height: cardHeight,
                    flexShrink: 0,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'center center',
                  }}
                >
                  <ShareCard
                    ref={previewCardRef}
                    payload={capturePayload}
                    template={template}
                    background={background}
                    backgroundImageUrl={background.imageUrl}
                  />
                </div>
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
            {canShareNatively ? (
              <SecondaryButton
                isMobile={isMobile}
                onClick={() => handleExport('share')}
                disabled={!!busy || selectedLines.length === 0}
              >
                {busy === 'share' ? '处理中…' : '分享'}
              </SecondaryButton>
            ) : null}
            <PrimaryButton
              isMobile={isMobile}
              onClick={() => handleExport('download')}
              disabled={!!busy || selectedLines.length === 0}
            >
              {busy === 'download' ? '生成中…' : '保存图片'}
            </PrimaryButton>
          </div>
        </div>
      </div>

      {/* Full-screen zoom. Same card, scaled to fill the viewport. */}
      {zoomed ? (
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
          }}
        >
          <div
            style={{
              width: SHARE_CARD_WIDTH * zoomScale,
              height: cardHeight * zoomScale,
              flexShrink: 0,
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
            }}
          >
            <div
              style={{
                width: SHARE_CARD_WIDTH,
                height: cardHeight,
                transform: `scale(${zoomScale})`,
                transformOrigin: 'top left',
              }}
            >
              <ShareCard
                payload={capturePayload}
                template={template}
                background={background}
                backgroundImageUrl={background.imageUrl}
              />
            </div>
          </div>

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
            点击任意位置或按 Esc 返回
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
