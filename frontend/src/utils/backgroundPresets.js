/**
 * Gradient surface presets, shared by the chat wallpaper picker and the
 * share-card renderer.
 *
 * This is the single source of truth for the `css` string of every gradient.
 * Both surfaces read the same value, so a tweak to a palette lands in the chat
 * background and in the exported screenshot at once — they are meant to look
 * like the same product.
 *
 * `GRADIENT_BACKGROUNDS` carries `id`, `label` and `css`; the colours that sit
 * *on* that surface (bubbles, text, icons) live next to it in
 * `SURFACE_PALETTES`, because the chat messages area and the exported card both
 * paint on these backgrounds and must not drift apart.
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
 * The colour set a message surface on a given background needs.
 *
 * One palette per background, keyed by the gradient's preset id (plus `plain`
 * for "no wallpaper"):
 *
 * - `textColor`        primary text painted straight onto the surface, and the
 *                      colour the name header inherits.
 * - `mutedColor`       secondary text on the surface — names, meta, empty
 *                      states, the branch counter.
 * - `iconColor`        idle colour for the hover-revealed message controls.
 * - `accent`           highlight colour (the pinned badge).
 * - `dividerColor`     hairline drawn on the surface — the card's avatar ring
 *                      and its header/footer rules.
 * - `bubbleUser`/`bubbleChar`          the bubble fill for each speaker.
 * - `bubbleUserText`/`bubbleCharText`  the text that sits inside those fills.
 *
 * There is deliberately no `isDark` flag: the palette *is* the answer to
 * "is this surface dark", and the presets above already carry the one
 * darkness flag in the system (`GRADIENT_BACKGROUNDS[].isDark`). A second
 * copy could only drift.
 *
 * `plain` reproduces the chat's original hardcoded colours exactly
 * (`#f5f6fa` / `#232323`), so the default background is untouched by the
 * palette work; only the coloured presets change.
 *
 * The dark/saturated bubbles intentionally match the exported card, including
 * the saturated user bubble on the light gradients: the card already renders
 * the shared markdown pipeline on exactly these fills, and
 * `ChatBubble.css`'s `.chat-bubble-tinted` block mirrors the card's surface
 * fixes for the same reason.
 */
export const SURFACE_PALETTES = {
  plain: {
    id: 'plain',
    textColor: '#232323',
    mutedColor: '#6b7280',
    iconColor: '#9ca3af',
    accent: '#334155',
    dividerColor: 'rgba(35, 35, 35, 0.1)',
    bubbleUser: '#f5f6fa',
    bubbleUserText: '#232323',
    bubbleChar: '#f5f6fa',
    bubbleCharText: '#232323',
  },
  lavender: {
    id: 'lavender',
    textColor: '#2c2342',
    mutedColor: '#6f6591',
    iconColor: '#6f6591',
    accent: '#7a68b8',
    dividerColor: 'rgba(122, 104, 184, 0.22)',
    bubbleUser: 'linear-gradient(135deg, #8f7fd6 0%, #6d5cb4 100%)',
    bubbleUserText: '#ffffff',
    bubbleChar: 'rgba(255, 255, 255, 0.9)',
    bubbleCharText: '#2c2342',
  },
  midnight: {
    id: 'midnight',
    textColor: '#f4f1fb',
    mutedColor: '#b3a9d6',
    iconColor: 'rgba(255, 255, 255, 0.62)',
    accent: '#c2b0f5',
    dividerColor: 'rgba(226, 217, 255, 0.22)',
    bubbleUser: 'linear-gradient(135deg, #9b86e8 0%, #7059c9 100%)',
    bubbleUserText: '#ffffff',
    bubbleChar: 'rgba(255, 255, 255, 0.12)',
    bubbleCharText: '#f4f1fb',
  },
  sunrise: {
    id: 'sunrise',
    textColor: '#43242a',
    mutedColor: '#96686c',
    iconColor: '#96686c',
    accent: '#d9748b',
    dividerColor: 'rgba(217, 116, 139, 0.26)',
    bubbleUser: 'linear-gradient(135deg, #f59aa6 0%, #e0708c 100%)',
    bubbleUserText: '#ffffff',
    bubbleChar: 'rgba(255, 255, 255, 0.92)',
    bubbleCharText: '#43242a',
  },
  paper: {
    id: 'paper',
    textColor: '#33291c',
    mutedColor: '#7d7161',
    iconColor: '#7d7161',
    accent: '#9c7a44',
    dividerColor: 'rgba(156, 122, 68, 0.25)',
    bubbleUser: 'linear-gradient(135deg, #b99b6a 0%, #9c7a44 100%)',
    bubbleUserText: '#ffffff',
    bubbleChar: 'rgba(255, 255, 255, 0.9)',
    bubbleCharText: '#33291c',
  },
};

/**
 * Palette for the chat's message surface behind a given wallpaper.
 *
 * Only `kind: 'gradient'` gets a tinted palette. An uploaded/character image is
 * veiled with frosted white by `getChromeSurface` **and blurred by the message
 * list**, and `kind: 'none'` is plain white, so both are genuinely light
 * surfaces — the exported card paints those two dark, but the chat does not, and
 * the palette has to describe the surface the chat actually shows.
 *
 * Always returns a module-level constant, never a fresh object: `MessageBubble`
 * is memoized and re-renders on every streaming chunk, so an identity that
 * changes per render would defeat the memo for the whole thread.
 */
export function getSurfacePalette(background) {
  if (!background || background.kind !== 'gradient') return SURFACE_PALETTES.plain;
  return SURFACE_PALETTES[resolveBackgroundPresetId(background.id)] || SURFACE_PALETTES.plain;
}

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
