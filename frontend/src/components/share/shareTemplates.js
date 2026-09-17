/**
 * Data-driven definitions for the share-card renderer.
 *
 * The renderer (`ShareCard.jsx`) is layout-only: it reads a template (how the
 * messages are laid out) and a background (the palette + surface behind them).
 * Adding a new look means adding an entry here, never a new component.
 */

import { GRADIENT_BACKGROUNDS } from '../../utils/backgroundPresets';

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
export const DEFAULT_BACKGROUND_ID = 'lavender';

/**
 * Background presets.
 *
 * kind: 'gradient' -> `css` paints the card.
 *       'image'    -> a photo/illustration is painted full-bleed behind an
 *                     `overlay` gradient; the palette switches to light-on-dark.
 *
 * Every background owns the complete colour set the card needs, so the renderer
 * never has to guess whether it is on a light or dark surface.
 */
export const SHARE_BACKGROUNDS = [
  {
    ...gradient('lavender'),
    kind: 'gradient',
    textColor: '#2c2342',
    mutedColor: '#6f6591',
    accent: '#7a68b8',
    dividerColor: 'rgba(122, 104, 184, 0.22)',
    watermarkColor: '#5f5580',
    bubbleUser: 'linear-gradient(135deg, #8f7fd6 0%, #6d5cb4 100%)',
    bubbleUserText: '#ffffff',
    bubbleChar: 'rgba(255, 255, 255, 0.9)',
    bubbleCharText: '#2c2342',
  },
  {
    ...gradient('midnight'),
    kind: 'gradient',
    textColor: '#f4f1fb',
    mutedColor: '#b3a9d6',
    accent: '#c2b0f5',
    dividerColor: 'rgba(226, 217, 255, 0.22)',
    watermarkColor: '#ded5ff',
    bubbleUser: 'linear-gradient(135deg, #9b86e8 0%, #7059c9 100%)',
    bubbleUserText: '#ffffff',
    bubbleChar: 'rgba(255, 255, 255, 0.12)',
    bubbleCharText: '#f4f1fb',
  },
  {
    ...gradient('sunrise'),
    kind: 'gradient',
    textColor: '#43242a',
    mutedColor: '#96686c',
    accent: '#d9748b',
    dividerColor: 'rgba(217, 116, 139, 0.26)',
    watermarkColor: '#8c5a63',
    bubbleUser: 'linear-gradient(135deg, #f59aa6 0%, #e0708c 100%)',
    bubbleUserText: '#ffffff',
    bubbleChar: 'rgba(255, 255, 255, 0.92)',
    bubbleCharText: '#43242a',
  },
  {
    ...gradient('paper'),
    kind: 'gradient',
    textColor: '#33291c',
    mutedColor: '#7d7161',
    accent: '#9c7a44',
    dividerColor: 'rgba(156, 122, 68, 0.25)',
    watermarkColor: '#6d5c44',
    bubbleUser: 'linear-gradient(135deg, #b99b6a 0%, #9c7a44 100%)',
    bubbleUserText: '#ffffff',
    bubbleChar: 'rgba(255, 255, 255, 0.9)',
    bubbleCharText: '#33291c',
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
