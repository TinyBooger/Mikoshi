/**
 * Gradient surface presets, shared by the chat wallpaper picker and the
 * share-card renderer.
 *
 * This is the single source of truth for the `css` string of every gradient.
 * Both surfaces read the same value, so a tweak to a palette lands in the chat
 * background and in the exported screenshot at once — they are meant to look
 * like the same product.
 *
 * Only `id`, `label` and `css` live here. Anything surface-specific (share-card
 * text colours, watermarks, bubble palettes) stays with its consumer.
 *
 * The angle is fixed at 158deg — near-vertical but tilted, which reads the same
 * on a wide desktop chat panel and on the 4:5 export, where a 135deg diagonal
 * would visibly change direction between the two.
 */
export const GRADIENT_BACKGROUNDS = [
  {
    id: 'lavender',
    label: '薰衣草',
    css: 'linear-gradient(158deg, #fdfbff 0%, #f0e9fb 42%, #d9cbf2 100%)',
  },
  {
    id: 'midnight',
    label: '深夜',
    css: 'linear-gradient(158deg, #1a1730 0%, #241f47 46%, #3b2f63 100%)',
    // Dark *and* un-veiled: the chat chrome is transparent over a gradient, so
    // text painted straight onto this surface has to flip to light.
    isDark: true,
  },
  {
    id: 'sunrise',
    label: '日出',
    css: 'linear-gradient(158deg, #fff6ee 0%, #ffe6dd 45%, #ffd0c9 100%)',
  },
  {
    id: 'paper',
    label: '信纸',
    css: 'linear-gradient(158deg, #fbf8f1 0%, #f3ede0 50%, #e6dcc7 100%)',
  },
];

/**
 * Preset ids that used to point at bundled SVG images (`/wallpapers/*.svg`)
 * and no longer have a picker entry.
 *
 * They are aliased rather than dropped so that characters saved before this
 * change keep a background instead of silently falling back to plain white.
 * `sunrise` is absent on purpose: the new gradient reuses that id and is the
 * natural continuation of the old artwork.
 *
 * These ids stay allowed by the backend (`ALLOWED_PRESET_IDS` in
 * `routes/character.py`) so a round-trip through the character form does not
 * erase the stored value.
 */
const LEGACY_PRESET_ALIASES = {
  aurora: 'lavender',
  waves: 'lavender',
};

/** Map a stored preset id onto a preset this build can actually render. */
export const resolveBackgroundPresetId = (id) => LEGACY_PRESET_ALIASES[id] || id;

/**
 * Surface colour for the chat chrome that floats above the wallpaper — the
 * message list and the composer.
 *
 * The three kinds want genuinely different treatment:
 *
 * - `image`    — a photo is busy, so the chrome is veiled with frosted white to
 *                keep text legible over arbitrary artwork.
 * - `gradient` — already a designed surface, so the chrome is transparent and
 *                the gradient shows through unmodified. Veiling it would wash
 *                out the dark palettes into a near-white panel.
 * - `none`     — nothing behind the chrome, so it is plain white.
 *
 * Only the colour is returned; whether a veil is also blurred is left to the
 * caller, since the composer and the message list have always differed there.
 */
export function getChromeSurface(kind) {
  if (kind === 'image') return { background: 'rgba(255, 255, 255, 0.76)' };
  if (kind === 'gradient') return { background: 'transparent' };
  return { background: '#fff' };
}

/** Whether the chrome is showing a frosted veil that should also be blurred. */
export const isVeiledBackground = (kind) => kind === 'image';

/**
 * Whether text painted directly on the surface (no bubble behind it) must be
 * light.
 *
 * Only un-veiled dark gradients qualify. Image backgrounds are veiled with
 * frosted white, so dark text stays readable on them no matter how dark the
 * photo is — which is exactly why this keys off the same `kind` rule as
 * `getChromeSurface` rather than the palette alone.
 */
export const isDarkSurface = (background) =>
  background?.kind === 'gradient' && !!background?.isDark;
