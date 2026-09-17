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
const IMAGE_FETCH_TIMEOUT_MS = 8000;

async function inlineImagesAsDataUrls(root) {
  const images = Array.from(root.querySelectorAll('img[data-share-image]'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      // `fetch` has no timeout of its own, and html2canvas's `imageTimeout` does
      // not cover this call. Without an abort, one stalled image leaves the
      // export pending forever — which strands the dialog in its busy state and
      // leaves every button disabled.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(src, {
          mode: 'cors',
          credentials: 'omit',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const blob = await response.blob();
        if (!blob || blob.size === 0) return;
        img.src = await blobToDataUrl(blob);
      } catch {
        // Offline, blocked by CORS, timed out, or not an image — leave it alone.
      } finally {
        clearTimeout(timer);
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
  // Revoke late: `click()` only *queues* the download, and revoking on the next
  // tick can cancel it before the browser has read the blob back out.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Save a PNG to the user's machine, preferring the real "Save as…" dialog.
 *
 * Where the File System Access API exists the file is written to the location
 * the user picks; everywhere else (Firefox, Safari) this degrades to a plain
 * browser download.
 *
 * Returns `'saved'` when a location was chosen, `'cancelled'` when the user
 * dismissed the picker, and `'downloaded'` for the fallback path. It never
 * throws for a cancelled picker — that is a normal outcome, not a failure.
 */
export async function saveImageBlob(blob, filename) {
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'PNG 图片', accept: { 'image/png': ['.png'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      // Anything else — notably a `SecurityError` when rendering the card took
      // longer than the click's transient activation — falls back to download.
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export async function copyImageBlobToClipboard(blob) {
  const ClipboardItemCtor = window.ClipboardItem;
  if (!navigator.clipboard?.write || !ClipboardItemCtor) return false;
  try {
    await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
    return true;
  } catch {
    // Insecure context, denied permission, or a browser that refuses a raw
    // Blob value here (older Safari wants a Promise). Report it as unsupported
    // rather than letting it surface as "generating the image failed".
    return false;
  }
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
