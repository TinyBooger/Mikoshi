/**
 * Static constants hoisted out of ChatPage.jsx.
 *
 * Nothing in here depends on props, state, or React — it is plain data plus
 * module-scope plugin/component references. Keeping these at module scope (as
 * they already were) preserves the stable object identities that the memoized
 * MessageBubble render path relies on during streaming.
 */

import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import CodeBlock from '../components/CodeBlock';
import MarkdownLink from '../components/MarkdownLink';
import { HIGHLIGHT_ALIASES, HIGHLIGHT_LANGUAGES } from './highlightLanguages';
import { GRADIENT_BACKGROUNDS } from './backgroundPresets';

/**
 * Wallpaper choices offered in the chat sidebar and the character form.
 *
 * `kind` tells the chat surface how to paint it: `none` is plain white,
 * `gradient` paints `css`, and an entry with a `url` is treated as an image.
 * Presets carry no `url` — `getSelectedWallpaper` resolves the id back to the
 * full entry.
 */
export const WALLPAPER_OPTIONS = [
  { id: 'none', label: '默认', kind: 'none', url: null, css: null },
  ...GRADIENT_BACKGROUNDS.map((bg) => ({ ...bg, kind: 'gradient', url: null })),
];

// Markdown pipeline for message bubbles.
//
// Remark (markdown -> mdast): GFM for tables/strikethrough/task lists/footnotes,
// plus math so `$inline$` and `$$display$$` are parsed as math instead of text.
export const REMARK_PLUGINS = [remarkGfm, remarkMath];

// Rehype (hast -> hast) runs in array order, so KaTeX must come first: it
// rewrites the math `code` nodes into KaTeX spans before the highlighter scans
// for `pre > code`. Otherwise a display block would look like a code block whose
// language is `math`.
export const REHYPE_PLUGINS = [
  [
    rehypeKatex,
    {
      // rehype-katex always renders with `throwOnError` first and falls back to
      // a `<span class="katex-error">` on failure, so a malformed formula shows
      // as an inline error instead of blanking the message.
      errorColor: '#e0574d',
      // Silence KaTeX's non-standard-input warnings (unicode, etc.) that models
      // trigger constantly. Genuine parse errors still surface as above.
      strict: false,
    },
  ],
  [
    rehypeHighlight,
    {
      // Only highlight fences that declare a language: guessing on plain text
      // produces more wrong colors than useful ones. Unregistered languages
      // (```mermaid, ```output) are skipped with a vfile message by the plugin
      // itself, so they degrade to plain code blocks instead of failing.
      detect: false,
      // Replaces lowlight's `common` default (37 grammars) rather than extending
      // it — see utils/highlightLanguages.js for the set and the reasoning.
      // `subset` is not used here: it only narrows what `detect` may guess.
      languages: HIGHLIGHT_LANGUAGES,
      aliases: HIGHLIGHT_ALIASES,
    },
  ],
];

// Renderer overrides for the markdown pipeline.
//
// Kept at module scope so the object identity is stable across renders — an
// inline object literal would be a new value every render, which defeats the
// React.memo on MessageBubble during streaming.
export const MARKDOWN_COMPONENTS = {
  pre: CodeBlock,
  a: MarkdownLink,
};

export const SHARED_TOKEN_LIMITS = { min: 1, max: 8192, defaultValue: 4096 };
export const SHARED_TOKEN_TIERS = [1024, 2048, 4096, 6144, 8192];

export const DEFAULT_ADVANCED_CHAT_CONFIG = {
  model: 'qwen-plus-character',
  presence_penalty: 0,
  frequency_penalty: 0,
  interface_preference: 'bubbles',
};

// Sentinel used to indicate a character should have an improvising greeting
export const SPECIAL_IMPROVISING_GREETING = '[IMPROVISE_GREETING]';
export const SUMMARY_PREFIX = 'Summary of previous conversation:';

export const CHAT_INPUT_MAX_HEIGHT = 200;
export const CHAT_INPUT_BASE_HEIGHT = 44;
