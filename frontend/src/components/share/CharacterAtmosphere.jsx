import { useEffect, useRef } from 'react';

/**
 * The wash behind the gallery stage, sampled from the artwork itself.
 *
 * The `sheet` template sets the artwork on a mat. A flat grey mat works, but it
 * cannot answer the two cases that actually matter: near-white artwork
 * dissolves into a light mat, and dark artwork floats on one. So the mat takes
 * its atmosphere from the picture — the average colour of a 48px thumbnail,
 * scaled back up. Down and up again is also the whole reason the wash reads as
 * soft: html2canvas parses no CSS `filter`, so any blur *has* to come from
 * resampling. Nothing here modifies the artwork that sits on top of it.
 *
 * Reports through `onReady({ dataUrl, isDark })`, or `onReady(null)` when the
 * picture cannot be read — a cross-origin image without CORS headers, say — so
 * the caller falls back to a flat mat instead of waiting forever.
 *
 * Renders nothing, and keeps `onReady` in a ref for the same reason
 * `CharacterQrCode` does: the caller passes an inline callback, and a new
 * function identity must not restart the sampling.
 */
const SAMPLE_SIZE = 48;

/**
 * The average colour of the thumbnail, composited over white.
 *
 * Character art is often a transparent PNG, and a transparent pixel reads as
 * `0,0,0` — averaging it straight in would darken the mat by however much empty
 * margin the artwork happens to carry. Compositing over white instead measures
 * what the picture will actually look like on the stage, and leaves an opaque
 * image's average untouched.
 */
function averageColor(ctx) {
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    const clear = 255 * (1 - alpha);
    r += data[i] * alpha + clear;
    g += data[i + 1] * alpha + clear;
    b += data[i + 2] * alpha + clear;
  }
  const pixels = data.length / 4;
  return { r: r / pixels, g: g / pixels, b: b / pixels };
}

export default function CharacterAtmosphere({ url, onReady }) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    // A data URL means the exporter already inlined this picture, which only
    // happens on a second capture — the first one already reported. Reporting
    // `null` keeps this effect from being the thing that invalidates a render
    // that is already in flight.
    if (!url || String(url).startsWith('data:')) {
      onReadyRef.current?.(null);
      return undefined;
    }

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    // Mirrors `fetchImageBytes`: the plain `<img>` the sidebar already rendered
    // fetched this URL without CORS, and a CORS-mode request can be served that
    // cached response and rejected. One cache-busted retry before giving up.
    let busted = false;

    const report = (value) => {
      if (!cancelled) onReadyRef.current?.(value);
    };

    image.onload = () => {
      if (cancelled) return;
      let atmosphere = null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { r, g, b } = averageColor(ctx);
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        atmosphere = { dataUrl: canvas.toDataURL('image/jpeg', 0.72), isDark: luminance < 0.5 };
      } catch {
        atmosphere = null; // Tainted canvas or an unreadable image — flat mat.
      }
      report(atmosphere);
    };
    image.onerror = () => {
      if (cancelled || busted) {
        if (!cancelled) report(null);
        return;
      }
      busted = true;
      image.src = `${url}${url.includes('?') ? '&' : '?'}_share=${Date.now()}`;
    };

    image.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return null;
}
