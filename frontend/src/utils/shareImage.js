/**
 * PNG export helpers for the share card.
 *
 * `html2canvas` is the only rasteriser: it walks a DOM subtree and paints it
 * into a `<canvas>`. Because the share card is a dedicated, simple tree (see
 * `components/share/ShareCard.jsx`) it stays inside the CSS subset html2canvas
 * supports — plain boxes, solid/rgba colours, linear gradients and `<img>`.
 */
import html2canvas from 'html2canvas';

/** 2x gives a 2160px-wide PNG (crisp on retina, still social-media friendly). */
export const SHARE_EXPORT_SCALE = 2;

export async function captureShareCard(element, { scale = SHARE_EXPORT_SCALE } = {}) {
  if (!element) throw new Error('Share card is not mounted');

  // Resolve every image to a data URL FIRST, then wait for them to settle, so
  // the capture never races a still-loading avatar (html2canvas would
  // otherwise paint an empty box).
  await inlineImagesAsDataUrls(element);
  await waitForImages(element);

  return html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    logging: false,
    imageTimeout: 15000,
  });
}

/**
 * Rewrite every `img[data-share-image]` in the card to a data URL.
 *
 * html2canvas loads images itself with `crossOrigin: 'anonymous'` and silently
 * drops any image whose server refuses to share it (no
 * `Access-Control-Allow-Origin` header) — which is exactly how avatars can go
 * missing from an export while they look fine in the DOM. Fetching the bytes
 * here and handing the rasteriser a data URL takes both the network and the
 * CORS check out of the capture path.
 *
 * A failure is not fatal: the original `src` is kept, and every avatar sits on
 * a same-origin fallback background that still paints.
 */
async function inlineImagesAsDataUrls(root) {
  const images = Array.from(root.querySelectorAll('img[data-share-image]'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      try {
        const response = await fetch(src, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) return;
        const blob = await response.blob();
        if (!blob || blob.size === 0) return;
        img.src = await blobToDataUrl(blob);
      } catch {
        // Offline, blocked by CORS, or not an image — leave the element alone.
      }
    }),
  );
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode PNG'));
    }, 'image/png');
  });
}

export function buildShareFilename(characterName) {
  const safe =
    String(characterName || 'yubandao')
      .replace(/[\\/:*?"<>|\s]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'yubandao';
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  return `yubandao-${safe}-${stamp}.png`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** True when the Web Share API can hand a PNG file to the OS share sheet. */
export function canShareImageFile(file) {
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
    ? navigator.canShare({ files: [file] })
    : false;
}

export async function shareImageBlob(blob, filename, title) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (!canShareImageFile(file)) return false;
  await navigator.share({ files: [file], title });
  return true;
}

export async function copyImageBlobToClipboard(blob) {
  const ClipboardItemCtor = window.ClipboardItem;
  if (!navigator.clipboard?.write || !ClipboardItemCtor) return false;
  await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
  return true;
}

function waitForImages(root) {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          // Never let a stuck request block the export.
          setTimeout(done, 8000);
        }),
    ),
  );
}
