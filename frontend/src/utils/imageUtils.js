// Helpers to crop + compress image using canvas
// Options:
// - maxDimension: max width/height of output (default 1024)
// - format: 'auto' | 'jpeg' | 'png' | 'webp' (default 'auto')
// - quality: number 0..1 for lossy formats (default 0.85)
// - maxBytes: optional hard cap; reduces quality iteratively to fit
// - fillBackground: used when converting to JPEG and transparency exists (default '#ffffff')
export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0, options = {}) {
  const {
    maxDimension = 1024,
    format = 'auto',
    quality = 0.85,
    maxBytes,
    fillBackground = '#ffffff',
  } = options || {};

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', error => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const image = await createImage(imageSrc);

  // 1) Draw crop at native resolution
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(1, Math.round(pixelCrop.width));
  cropCanvas.height = Math.max(1, Math.round(pixelCrop.height));
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  );

  // 2) Downscale if necessary to respect maxDimension
  const ratio = Math.min(1, maxDimension / Math.max(cropCanvas.width, cropCanvas.height));
  const outCanvas = document.createElement('canvas');
  outCanvas.width = Math.max(1, Math.round(cropCanvas.width * ratio));
  outCanvas.height = Math.max(1, Math.round(cropCanvas.height * ratio));
  const outCtx = outCanvas.getContext('2d');
  outCtx.drawImage(cropCanvas, 0, 0, outCanvas.width, outCanvas.height);

  // 3) Detect alpha in the output to decide format when auto
  const hasAlpha = (() => {
    try {
      const { data } = outCtx.getImageData(0, 0, outCanvas.width, outCanvas.height);
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 255) return true;
      }
    } catch (_) { /* ignore */ }
    return false;
  })();

  const srcMime = (() => {
    // imageSrc is a dataURL from FileReader; extract mime if present
    const m = typeof imageSrc === 'string' ? imageSrc.match(/^data:([^;]+);base64,/) : null;
    return m ? m[1] : undefined;
  })();

  function pickMime() {
    if (format === 'jpeg') return 'image/jpeg';
    if (format === 'png') return 'image/png';
    if (format === 'webp') return 'image/webp';
    // auto: prefer webp everywhere; preserve alpha with webp, otherwise jpeg for compatibility
    if (hasAlpha) return 'image/webp';
    // If original looked like png but no alpha now, still okay to use webp/jpeg
    return 'image/webp';
  }

  const targetMimeInitial = pickMime();

  const canvasToBlob = (canvas, mime, q) => new Promise(resolve => {
    canvas.toBlob(b => resolve(b), mime, q);
  });

  // If converting to jpeg and we had alpha, fill background first
  async function exportBlobWithFallback(preferredMime, initialQuality) {
    // Ensure background for jpeg
    if (preferredMime === 'image/jpeg' && hasAlpha) {
      const withBg = document.createElement('canvas');
      withBg.width = outCanvas.width;
      withBg.height = outCanvas.height;
      const bgCtx = withBg.getContext('2d');
      bgCtx.fillStyle = fillBackground;
      bgCtx.fillRect(0, 0, withBg.width, withBg.height);
      bgCtx.drawImage(outCanvas, 0, 0);
      return (await canvasToBlob(withBg, preferredMime, initialQuality))
        || (await canvasToBlob(withBg, 'image/webp', initialQuality))
        || (await canvasToBlob(withBg, 'image/png'));
    }
    // Normal path
    return (await canvasToBlob(outCanvas, preferredMime, initialQuality))
      || (await canvasToBlob(outCanvas, 'image/jpeg', initialQuality))
      || (await canvasToBlob(outCanvas, 'image/png'));
  }

  let q = quality;
  let blob = await exportBlobWithFallback(targetMimeInitial, q);

  if (maxBytes && blob && blob.size > maxBytes) {
    // Iteratively reduce quality for lossy formats; floor at 0.5
    const minQ = 0.5;
    let attempts = 0;
    while (blob && blob.size > maxBytes && q > minQ && attempts < 6) {
      q = Math.max(minQ, q - 0.1);
      blob = await exportBlobWithFallback(targetMimeInitial, q);
      attempts += 1;
    }
  }

  // Fallback in case toBlob returned null for all mimes
  if (!blob) {
    blob = await canvasToBlob(outCanvas, 'image/png');
  }

  const dataUrl = await new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  return { blob, dataUrl, mime: blob.type, srcMime };
}

export function fileNameWithExt(originalName, desiredMime, fallback = 'image/png') {
  const mime = desiredMime || fallback;
  const ext = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '.png';
  const base = (originalName || 'image').replace(/\.[^.]*$/, '');
  return base + ext;
}
