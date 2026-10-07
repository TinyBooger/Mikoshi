import React, { useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';

/**
 * Renders the character card's QR code off-screen and hands back a PNG data URL.
 *
 * `react-qr-code` emits an `<svg>` of two `<path>` elements. html2canvas's SVG
 * handling is inconsistent across browsers, and a QR code that silently drops
 * out of an export is worse than useless — it is the whole point of the card.
 * So the SVG is rasterised here, ahead of the capture, and the card mounts the
 * result as a plain `<img data-share-image>`, which goes through the same
 * resolve-to-data-URL path as every avatar (see `inlineImagesAsDataUrls`).
 *
 * The generated SVG carries explicit `width`/`height`/`viewBox`, so serialising
 * it and decoding it through an `<img>` needs no extra sizing.
 *
 * Render this OUTSIDE the node handed to html2canvas: it paints a full-size
 * `<svg>` inside a zero-size clipped box, exactly like the off-screen card node
 * itself, and only the `<img>` the card mounts should end up in the export.
 */
export default function CharacterQrCode({
  value,
  size = 512,
  fgColor = '#1f1a2e',
  bgColor = '#ffffff',
  level = 'M',
  onReady,
  onError,
}) {
  const svgRef = useRef(null);
  // Kept in refs so a new inline callback on every parent render does not
  // re-trigger the (fairly expensive) rasterisation.
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  useEffect(() => {
    const node = svgRef.current;
    if (!node || !value) return undefined;

    let cancelled = false;
    const svgMarkup = new XMLSerializer().serializeToString(node);
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, size, size);
        onReadyRef.current?.(canvas.toDataURL('image/png'));
      } catch {
        onErrorRef.current?.();
      }
    };
    image.onerror = () => {
      if (!cancelled) onErrorRef.current?.();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

    return () => {
      cancelled = true;
    };
  }, [value, size, fgColor, bgColor, level]);

  return (
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
      <QRCode
        ref={svgRef}
        value={value}
        size={size}
        fgColor={fgColor}
        bgColor={bgColor}
        level={level}
      />
    </div>
  );
}
