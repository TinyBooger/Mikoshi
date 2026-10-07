/**
 * PNG export helpers for the share card.
 *
 * `html2canvas` is the only rasteriser: it walks a DOM subtree and paints it
 * into a `<canvas>`. Because the share card is a dedicated, simple tree (see
 * `components/share/ShareCard.jsx`) it stays inside the CSS subset html2canvas
 * supports — plain boxes, solid/rgba colours, linear gradients and `<img>`.
 *
 * That subset has one hole worth knowing about: `object-fit` and
 * `object-position` are not implemented at all, so `cover` crops and `contain`
 * letterboxes have to be applied to the image *bytes* before the capture — see
 * `fitBlobToBox`.
 */
import html2canvas from 'html2canvas';

/** 2x gives a 2160px-wide PNG (crisp on retina, still social-media friendly). */
export const SHARE_EXPORT_SCALE = 2;

/**
 * Largest canvas we will ask a browser to allocate, in pixels.
 *
 * Canvas ceilings are not uniform across browsers: Chrome and Firefox allow
 * roughly 268M pixels and a 65535px side, while iOS Safari gives up around
 * 16.7M. Staying inside the smallest of those keeps one card exporting the same
 * everywhere instead of coming back blank on one platform. A default
 * 1080x1350 card needs 2.9M pixels at 1x, so this is a long way off — it only
 * starts to matter because message bodies are no longer truncated, which is
 * what makes an eight-message card able to grow very tall.
 */
const MAX_CANVAS_PIXELS = 16777216;
const MAX_CANVAS_SIDE = 16384;

/**
 * Pick the export scale for a card that may be far taller than the default.
 *
 * `SHARE_EXPORT_SCALE` is a quality target, not a promise: the card's height
 * follows its content, so insisting on 2x for a 6000px-tall card would ask for a
 * 12000px canvas that a browser may simply refuse to allocate. A refused canvas
 * returns blank pixels rather than throwing, which surfaces to the user as a
 * mysteriously empty preview. So back the scale off by just enough to fit, and
 * leave 2x untouched for every card of ordinary length.
 *
 * Never below 1x: sub-1 scaling resamples the text and the card stops being
 * legible, which is worse than a large image.
 */
function resolveExportScale(element, requested) {
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  if (!(width > 0) || !(height > 0)) return requested;
  const byArea = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
  const bySide = Math.min(MAX_CANVAS_SIDE / width, MAX_CANVAS_SIDE / height);
  const fitted = Math.min(requested, byArea, bySide);
  if (fitted >= requested) return requested;
  // Two decimal places keeps the resulting canvas size predictable rather than
  // tracking sub-pixel noise in the card's measured height.
  return Math.max(1, Math.floor(fitted * 100) / 100);
}

export async function captureShareCard(element, { scale = SHARE_EXPORT_SCALE } = {}) {
  if (!element) throw new Error('Share card is not mounted');

  // Resolve every image to a data URL FIRST, then wait for them to settle, so
  // the capture never races a still-loading avatar (html2canvas would
  // otherwise paint an empty box).
  await inlineImagesAsDataUrls(element);
  await waitForImages(element);

  return html2canvas(element, {
    scale: resolveExportScale(element, scale),
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    logging: false,
    imageTimeout: 15000,
  });
}

/** How long a single image fetch may take before it is abandoned. */
const IMAGE_FETCH_TIMEOUT_MS = 8000;

/**
 * GET an image with a hard timeout.
 *
 * `fetch` has no timeout of its own and html2canvas's `imageTimeout` does not
 * cover this call, so without an abort one stalled image would leave the export
 * pending forever — which strands the dialog in its busy state with every
 * footer button disabled.
 */
async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the bytes of one card image, or `null` when they cannot be read.
 *
 * Two attempts on purpose. `/static` is served without `Cache-Control`, so the
 * browser applies *heuristic* freshness to it: the plain `<img>` request — which
 * needs no CORS permission — gets cached, and that cached entry carries no
 * `Access-Control-Allow-Origin`. A CORS-mode request for the same URL is then
 * answered out of that entry and rejected with "blocked by CORS policy", even
 * though the server does send the header for a fresh request. So ask once (with
 * `no-store`, which usually dodges the entry), then ask again through a
 * cache-busting query so a stale entry cannot be hit at all.
 */
async function fetchImageBytes(src) {
  const busted = `${src}${src.includes('?') ? '&' : '?'}_share=${Date.now()}`;
  for (const url of [src, busted]) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) continue;
      const blob = await response.blob();
      if (blob && blob.size > 0) return blob;
    } catch {
      // Offline, timed out, or still blocked — try the cache-busted URL next.
    }
  }
  return null;
}

/**
 * Rewrite every `img[data-share-image]` in the card to a data URL.
 *
 * html2canvas loads images itself with `crossOrigin: 'anonymous'` and silently
 * drops any image whose server refuses to share it — which is exactly how
 * avatars can go missing from an export while they look fine in the DOM.
 * Fetching the bytes here and handing the rasteriser a data URL takes both the
 * network and the CORS check out of the capture path.
 */
async function inlineImagesAsDataUrls(root) {
  const images = Array.from(root.querySelectorAll('img[data-share-image]'));
  await Promise.all(images.map(inlineShareImage));
}

/**
 * Resolve one card image to a data URL fitted to its box.
 *
 * The bytes are fitted to the element's `object-fit` first — see
 * `fitBlobToBox`. A failure is not fatal: the element falls back to its
 * bundled same-origin `data-share-fallback` where it has one, so a slot shows
 * placeholder art rather than an invisible hole.
 */
async function inlineShareImage(img) {
  // Already resolved by an earlier capture (the card node is reused), so there
  // is nothing to fetch and the crop is already baked in.
  const src = img.getAttribute('src');
  if (!src || src.startsWith('data:')) return;

  const fallback = img.dataset.shareFallback;
  const bytes = (await fetchImageBytes(src)) || (fallback ? await fetchImageBytes(fallback) : null);
  if (bytes) {
    img.src = await blobToDataUrl((await fitBlobToBox(bytes, img)) || bytes);
    return;
  }

  // The bytes are unreachable, so html2canvas will drop this element and leave
  // an empty hole where the avatar was. Point it at the bundled same-origin
  // fallback instead, which needs no CORS round-trip at all.
  if (fallback) img.src = fallback;
}

/** `object-position` keywords. `top`/`bottom` are vertical, `left`/`right` horizontal. */
const OBJECT_POSITION_KEYWORDS = { left: 0, right: 1, top: 0, bottom: 1, center: 0.5 };

/**
 * Resolve one `object-position` token to a 0..1 fraction of the free space.
 *
 * Only percentages and keywords are handled: percentages are what the computed
 * value actually is (`top center` computes to `50% 0%`), and a length needs the
 * box size to mean anything. Anything else falls back to centre, which is the
 * CSS initial value anyway.
 */
function objectPositionFraction(token) {
  const value = String(token || '').toLowerCase();
  if (!value) return null;
  if (value.endsWith('%')) {
    const percent = Number.parseFloat(value);
    return Number.isFinite(percent) ? percent / 100 : null;
  }
  return value in OBJECT_POSITION_KEYWORDS ? OBJECT_POSITION_KEYWORDS[value] : null;
}

/** Split a computed `object-position` into a `{ x, y }` anchor in 0..1. */
function resolveObjectPosition(value) {
  const tokens = String(value || '').trim().split(/\s+/).filter(Boolean);
  const first = tokens[0] || '';
  const firstIsVertical = first === 'top' || first === 'bottom';
  if (tokens.length === 1) {
    const only = objectPositionFraction(first) ?? 0.5;
    return firstIsVertical ? { x: 0.5, y: only } : { x: only, y: 0.5 };
  }
  // `object-position: top center` is legal, so the first token can belong to
  // either axis and a vertical keyword can only ever be the y value.
  const [a, b] = firstIsVertical ? [tokens[1], first] : [first, tokens[1]];
  return { x: objectPositionFraction(a) ?? 0.5, y: objectPositionFraction(b) ?? 0.5 };
}

/**
 * The region of an image that `object-fit: cover` + `object-position` shows.
 *
 * `cover` scales the image until *both* sides span the box, so the visible part
 * is the largest box of the box's aspect ratio that fits inside the image; the
 * leftover is cropped. The anchor then splits that leftover, exactly as
 * `object-position` does in CSS.
 */
function coverCropRect(naturalWidth, naturalHeight, boxWidth, boxHeight, anchor) {
  if (!(naturalWidth > 0) || !(naturalHeight > 0) || !(boxWidth > 0) || !(boxHeight > 0)) return null;
  const boxRatio = boxWidth / boxHeight;
  let width = naturalWidth;
  let height = naturalHeight;
  if (naturalWidth / naturalHeight > boxRatio) {
    width = naturalHeight * boxRatio; // Relatively wider than the box: crop the sides.
  } else {
    height = naturalWidth / boxRatio; // Relatively taller than the box: crop top/bottom.
  }
  width = Math.max(1, Math.min(naturalWidth, Math.round(width)));
  height = Math.max(1, Math.min(naturalHeight, Math.round(height)));
  return {
    x: Math.round((naturalWidth - width) * anchor.x),
    y: Math.round((naturalHeight - height) * anchor.y),
    width,
    height,
  };
}

/**
 * The region of an image that `object-fit: contain` keeps inside a box.
 *
 * `contain` scales the image until *one* side spans the box, so the leftover is
 * empty on the other axis. That gap is real estate the rasteriser has to be
 * told about: it is the difference between a letterboxed picture and a stretched
 * one.
 */
function containRect(naturalWidth, naturalHeight, boxWidth, boxHeight) {
  if (!(naturalWidth > 0) || !(naturalHeight > 0) || !(boxWidth > 0) || !(boxHeight > 0)) return null;
  const scale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  return { x: Math.round((boxWidth - width) / 2), y: Math.round((boxHeight - height) / 2), width, height };
}

/**
 * What to draw for one `object-fit`, expressed in source pixels.
 *
 * `cover` crops, so the canvas *is* the image at the box's ratio. `contain`
 * keeps everything, so the canvas is the box with the image centred inside it
 * and the leftover left transparent — which is exactly what `contain` shows on
 * screen. Either way the destination fills the canvas, which is what makes the
 * rasteriser's stretch-to-box a no-op. The canvas is never larger than the box
 * it stands in for, so growing it cannot grow the card.
 *
 * Returns `null` when there is nothing to rewrite: nothing was cropped, or the
 * box already has the image's own ratio and the canvas would be padding-free.
 */
function buildFitPlan(fit, naturalWidth, naturalHeight, boxWidth, boxHeight, anchor) {
  if (fit === 'cover') {
    const crop = coverCropRect(naturalWidth, naturalHeight, boxWidth, boxHeight, anchor);
    if (!crop || (crop.width >= naturalWidth - 1 && crop.height >= naturalHeight - 1)) return null;
    // `crop.x`/`crop.y` locate the crop inside the *source*, so the destination
    // is the canvas at the origin. Reusing the crop rect as the destination
    // would offset the draw by those same values and leave the canvas' left or
    // top edge unpainted — transparent for a PNG, black once encoded as JPEG.
    return {
      canvasWidth: crop.width,
      canvasHeight: crop.height,
      source: crop,
      target: { x: 0, y: 0, width: crop.width, height: crop.height },
    };
  }

  // Supersampled: `contain` never draws the image larger than the box, and the
  // export draws the whole card at `SHARE_EXPORT_SCALE`.
  const canvasWidth = Math.max(1, Math.round(boxWidth * SHARE_EXPORT_SCALE));
  const canvasHeight = Math.max(1, Math.round(boxHeight * SHARE_EXPORT_SCALE));
  const target = containRect(naturalWidth, naturalHeight, canvasWidth, canvasHeight);
  if (!target || (target.width >= canvasWidth - 1 && target.height >= canvasHeight - 1)) return null;
  return {
    canvasWidth,
    canvasHeight,
    source: { x: 0, y: 0, width: naturalWidth, height: naturalHeight },
    target,
  };
}

/**
 * Pre-apply `object-fit` to the *bytes* of one card image.
 *
 * html2canvas 1.4.1 does not implement `object-fit` or `object-position` — the
 * names appear nowhere in the bundle — and it paints a replaced element with
 * `drawImage(image, 0, 0, naturalWidth, naturalHeight, boxLeft, boxTop,
 * boxWidth, boxHeight)`, which is `fill` every time. So every fitted image on
 * the card arrives in the PNG stretched: the 2:3 立绘 squashed into the 2:1 hero
 * band, and a tall portrait flattened into a 56px circle.
 *
 * Most of those boxes already have the image's own ratio — the gallery frame
 * takes its height from the picture, so `contain` there is normally a no-op and
 * costs nothing. It only has work to do once a box's ratio stops matching the
 * image's: a `max-height` clamp, or a fixed box like the avatar.
 *
 * Rather than restate the fit in JavaScript, this reads it back off the
 * element: the rendered box gives the target ratio and the computed
 * `object-position` gives the anchor. The CSS stays the single source of truth
 * and the rasteriser's stretch-to-box becomes a no-op, because the source bytes
 * now already match the box — cropped for `cover`, letterboxed for `contain`.
 *
 * Returns `null` when there is nothing to do — no crop and no letterbox, a fit
 * that needs no help, or a platform that cannot decode the image — and the
 * caller then keeps the original bytes.
 */
async function fitBlobToBox(blob, img) {
  // No `createImageBitmap`: keep today's behaviour rather than block the capture
  // on a main-thread decode of a multi-megapixel image.
  if (typeof createImageBitmap !== 'function') return null;

  const styles = getComputedStyle(img);
  const fit = styles.objectFit;
  // `fill` is what the rasteriser does anyway, `none` is a no-op, and
  // `scale-down` only ever settles on one of the two handled here.
  if (fit !== 'cover' && fit !== 'contain') return null;

  // html2canvas paints into the element's *content* box, so the ratio has to be
  // measured against that and not against the border box — an avatar's 2px
  // border is otherwise counted as image area.
  const rect = img.getBoundingClientRect();
  const boxWidth =
    rect.width - (Number.parseFloat(styles.borderLeftWidth) || 0) - (Number.parseFloat(styles.borderRightWidth) || 0);
  const boxHeight =
    rect.height - (Number.parseFloat(styles.borderTopWidth) || 0) - (Number.parseFloat(styles.borderBottomWidth) || 0);
  if (!(boxWidth > 0) || !(boxHeight > 0)) return null;

  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null; // Undecodable, or an SVG with no intrinsic size — leave it be.
  }

  try {
    const plan = buildFitPlan(
      fit,
      bitmap.width,
      bitmap.height,
      boxWidth,
      boxHeight,
      resolveObjectPosition(styles.objectPosition),
    );
    // Nothing to rewrite — a square avatar in a square box, say. The original
    // bytes are already exactly right, so skip the re-encode. The 1px slack
    // inside `buildFitPlan` absorbs the layout rounding of an `auto` axis (the
    // watermark logo).
    if (!plan) return null;

    const canvas = document.createElement('canvas');
    canvas.width = plan.canvasWidth;
    canvas.height = plan.canvasHeight;
    canvas
      .getContext('2d')
      .drawImage(
        bitmap,
        plan.source.x,
        plan.source.y,
        plan.source.width,
        plan.source.height,
        plan.target.x,
        plan.target.y,
        plan.target.width,
        plan.target.height,
      );
    // Keep a photo a photo: re-encoding a JPEG as PNG here would swap a few
    // hundred KB of compressed pixels for several MB of base64, which
    // html2canvas then decodes and scales straight back down. A letterboxed
    // `contain` needs its alpha channel though, so only `cover` stays a JPEG.
    const jpeg = blob.type === 'image/jpeg' && fit === 'cover';
    return await encodeCanvas(canvas, jpeg ? 'image/jpeg' : 'image/png', jpeg ? 0.92 : undefined);
  } catch {
    return null; // Drawing or encoding failed — export the original bytes.
  } finally {
    bitmap.close?.();
  }
}

function encodeCanvas(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`Failed to encode ${mimeType}`))),
      mimeType,
      quality,
    );
  });
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
