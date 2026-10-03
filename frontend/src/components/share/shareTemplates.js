/**
 * Data-driven definitions for the share-card renderer.
 *
 * The renderer (`ShareCard.jsx`) is layout-only: it reads a template (how the
 * messages are laid out) and a background (the palette + surface behind them).
 * Adding a new look means adding an entry here, never a new component.
 */

import {
  GRADIENT_BACKGROUNDS,
  SURFACE_PALETTES,
  resolveBackgroundPresetId,
} from '../../utils/backgroundPresets';

/**
 * Pull a gradient preset in from the shared source so the chat background and
 * the exported card can never drift apart. Spread first — the card-specific
 * colours below override nothing, but keeping the shared pair (`css`, `label`)
 * at the top makes the shared ownership obvious at a glance.
 */
const gradient = (id) => {
  const preset = GRADIENT_BACKGROUNDS.find((bg) => bg.id === id);
  if (!preset) throw new Error(`Unknown gradient background preset: ${id}`);
  return preset;
};

/** Fixed export geometry. 4:5 portrait reads best on 小红书 / Instagram. */
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_MIN_HEIGHT = 1350;

export const SHARE_TEMPLATES = [
  { id: 'minimal', label: '极简' },
  { id: 'bubble', label: '气泡' },
];

export const DEFAULT_TEMPLATE_ID = 'minimal';
// The chat opens on '默认' (no wallpaper), so the card does too.
export const DEFAULT_BACKGROUND_ID = 'plain';

/**
 * Chat interface mode -> share template. Mirrors the chat's own rule, which is
 * strictly `interface_preference === 'clean'` (see `cleanMode` in ChatPage), so
 * an unknown/not-yet-loaded config must land on 'bubble' — the chat renders
 * bubbles in that case too, and the card should match what is on screen.
 */
export const getDefaultTemplateId = (interfacePreference) =>
  interfacePreference === 'clean' ? 'minimal' : 'bubble';

/**
 * Which background the card should start on, given the chat's wallpaper.
 *
 * The dialog should open looking like the conversation the user is on, so a
 * preset maps to its identically-named gradient, a photo maps to the
 * full-bleed image background, the character's own artwork has a dedicated
 * background, and the chat's plain default (`none` / '默认') maps to the card's
 * own plain surface.
 */
export function resolveShareBackgroundId({ wallpaperId, characterImageUrl, wallpaperUrl }) {
  if (wallpaperId === 'character_picture' && characterImageUrl) return 'character-art';
  if (wallpaperUrl) return 'chat-wallpaper';
  // 'none' is the chat's own default and now has an exact card equivalent, so
  // it must not be folded into a gradient.
  if (!wallpaperId || wallpaperId === 'none') return 'plain';
  const presetId = resolveBackgroundPresetId(wallpaperId);
  return SHARE_BACKGROUNDS.some((bg) => bg.kind === 'gradient' && bg.id === presetId)
    ? presetId
    : DEFAULT_BACKGROUND_ID;
}

/**
 * Background presets.
 *
 * kind: 'plain'    -> a flat surface; `css` is the flat colour. Mirrors the
 *                     chat's own default wallpaper, which is plain white.
 *       'gradient' -> `css` paints the card.
 *       'image'    -> a photo/illustration is painted full-bleed behind an
 *                     `overlay` gradient; the palette switches to light-on-dark.
 *
 * Every background owns the complete colour set the card needs, so the renderer
 * never has to guess whether it is on a light or dark surface.
 *
 * The flat and gradient entries take that colour set from `SURFACE_PALETTES`
 * (`utils/backgroundPresets.js`) rather than repeating it, so the exported card
 * and the chat messages area cannot drift apart — they are the same colours on
 * the same background. Only `watermarkColor`, which the chat has no equivalent
 * of, and the two full-bleed image entries (whose dark palettes are the card's
 * own choice, because the chat veils an image background instead) stay here.
 *
 * Ordering is the picker order, so the default sits first.
 */
export const SHARE_BACKGROUNDS = [
  {
    id: 'plain',
    label: '默认',
    kind: 'plain',
    css: '#ffffff',
    ...SURFACE_PALETTES.plain,
    watermarkColor: '#8b8b93',
  },
  {
    ...gradient('lavender'),
    ...SURFACE_PALETTES.lavender,
    kind: 'gradient',
    watermarkColor: '#5f5580',
  },
  {
    ...gradient('midnight'),
    ...SURFACE_PALETTES.midnight,
    kind: 'gradient',
    watermarkColor: '#ded5ff',
  },
  {
    ...gradient('sunrise'),
    ...SURFACE_PALETTES.sunrise,
    kind: 'gradient',
    watermarkColor: '#8c5a63',
  },
  {
    ...gradient('paper'),
    ...SURFACE_PALETTES.paper,
    kind: 'gradient',
    watermarkColor: '#6d5c44',
  },
  {
    id: 'character-art',
    label: '角色立绘',
    kind: 'image',
    source: 'character',
    overlay: 'linear-gradient(180deg, rgba(14, 10, 26, 0.3) 0%, rgba(14, 10, 26, 0.68) 46%, rgba(11, 8, 22, 0.94) 100%)',
    textColor: '#ffffff',
    mutedColor: 'rgba(255, 255, 255, 0.74)',
    accent: '#c9b6ff',
    dividerColor: 'rgba(255, 255, 255, 0.24)',
    watermarkColor: 'rgba(255, 255, 255, 0.92)',
    bubbleUser: 'linear-gradient(135deg, #8f7ad8 0%, #6d5cb4 100%)',
    bubbleUserText: '#ffffff',
    bubbleChar: 'rgba(255, 255, 255, 0.92)',
    bubbleCharText: '#241c38',
  },
  {
    id: 'chat-wallpaper',
    label: '聊天背景',
    kind: 'image',
    source: 'wallpaper',
    overlay: 'linear-gradient(180deg, rgba(20, 16, 34, 0.28) 0%, rgba(20, 16, 34, 0.7) 48%, rgba(14, 11, 26, 0.94) 100%)',
    textColor: '#ffffff',
    mutedColor: 'rgba(255, 255, 255, 0.74)',
    accent: '#d4c4ff',
    dividerColor: 'rgba(255, 255, 255, 0.24)',
    watermarkColor: 'rgba(255, 255, 255, 0.92)',
    bubbleUser: 'linear-gradient(135deg, #8f7ad8 0%, #6d5cb4 100%)',
    bubbleUserText: '#ffffff',
    bubbleChar: 'rgba(255, 255, 255, 0.92)',
    bubbleCharText: '#241c38',
  },
];

export const getShareTemplate = (id) =>
  SHARE_TEMPLATES.find((tpl) => tpl.id === id) || SHARE_TEMPLATES[0];

export const getShareBackground = (id) =>
  SHARE_BACKGROUNDS.find((bg) => bg.id === id) || SHARE_BACKGROUNDS[0];

/**
 * Backgrounds that are actually usable for the current conversation:
 * image backgrounds are dropped when the corresponding image is missing.
 */
export function getAvailableBackgrounds({ characterImageUrl, wallpaperUrl }) {
  return SHARE_BACKGROUNDS.filter((bg) => {
    if (bg.kind !== 'image') return true;
    if (bg.source === 'character') return !!characterImageUrl;
    if (bg.source === 'wallpaper') return !!wallpaperUrl;
    return true;
  }).map((bg) => ({ ...bg, imageUrl: resolveBackgroundImage(bg, { characterImageUrl, wallpaperUrl }) }));
}

function resolveBackgroundImage(bg, { characterImageUrl, wallpaperUrl }) {
  if (bg.kind !== 'image') return null;
  return bg.source === 'wallpaper' ? wallpaperUrl : characterImageUrl;
}
