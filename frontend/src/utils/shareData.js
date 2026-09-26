/**
 * Data helpers for the "制作截图" (share-card) feature.
 *
 * The share card is a *separate* render tree from the chat UI — it never
 * screenshots the live chat DOM. The pipeline is:
 *
 *   chat messages -> buildSharePayload() -> <ShareCard> -> html2canvas -> PNG
 *
 * Message bodies stay as raw Markdown all the way to the card and are rendered
 * by the same pipeline the chat uses (`components/MarkdownMessage.jsx`), so the
 * screenshot shows each message the way the chat displayed it — headings,
 * lists, tables, code blocks and math included. `stripMarkdownForShare` now
 * exists only to give the dialog's message picker a one-line plain-text label.
 */

/**
 * How many messages one card may carry.
 *
 * A *count* cap only. Message bodies are exported at full length: an earlier
 * version also cut each one to 260 characters, which filled long replies with
 * ellipses and made the card misrepresent the conversation it was showing.
 * The card is a minimum-height box, so it simply grows instead — see
 * `resolveExportScale` in `utils/shareImage.js` for the canvas ceiling that
 * has to be respected once height stops being bounded.
 */
export const MAX_SHARE_MESSAGES = 8;

/**
 * How many recent messages the dialog pre-selects when it opens. Small on
 * purpose: a card is a teaser, and three exchange-pairs already fill it.
 */
export const DEFAULT_SHARE_MESSAGE_COUNT = 3;

/**
 * Turn a stored media path (`/static/images/foo.png`) into a URL the browser
 * (and html2canvas) can load. Absolute URLs and data URIs pass through.
 */
export function resolveMediaUrl(path) {
  if (!path) return null;
  const raw = String(path).trim();
  if (!raw) return null;
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  const base = String(window.API_BASE_URL || '').replace(/\/$/, '');
  return `${base}/${raw.replace(/\\/g, '/').replace(/^\//, '')}`;
}

/**
 * Flatten a Markdown message body to a single line of plain text.
 *
 * This is *not* what the card shows — the card renders the real Markdown. It is
 * only used for the dialog's message picker, a list of labels that each have to
 * fit on one tail-truncated line, where reading `**` and `|---|` as literal
 * characters would be worse than losing them.
 *
 * Deliberately conservative: it only removes syntax that would look like noise
 * in a label (fences, emphasis markers, link URLs, table pipes) and never tries
 * to re-interpret the content.
 */
export function stripMarkdownForShare(raw) {
  if (typeof raw !== 'string' || !raw) return '';
  let text = raw;

  // Fenced code blocks: drop the fence + language tag, keep the code body.
  text = text.replace(/```[^\n]*\n?([\s\S]*?)\n?```/g, '$1');
  // Images -> alt text, links -> label.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Tables: drop separator rows, flatten cell pipes.
  text = text.replace(/^[ \t]*\|?[\s:|-]*-[\s:|-]*\|?[ \t]*$/gm, '');
  text = text.replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (line) => line.replace(/\|/g, ' ').trim());
  // Headings, blockquotes, list markers, horizontal rules.
  text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '');
  text = text.replace(/^[ \t]{0,3}>[ \t]?/gm, '');
  text = text.replace(/^[ \t]{0,3}([-*+]|\d+[.)])[ \t]+/gm, '· ');
  text = text.replace(/^[ \t]{0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/gm, '');
  // Raw HTML, autolinks, footnote markers.
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  text = text.replace(/<https?:[^>]*>/g, '');
  text = text.replace(/\[\^[^\]]*\]/g, '');
  // Math: keep the expression, drop the delimiters.
  text = text.replace(/\$\$([^$]+)\$\$/g, '$1');
  text = text.replace(/\$([^$\n]+)\$/g, '$1');
  // Inline emphasis / code. `**` before `*`; single `_` is left alone so that
  // snake_case identifiers survive.
  text = text.replace(/(\*\*|__)([\s\S]*?)\1/g, '$2');
  text = text.replace(/\*([^*\n]+)\*/g, '$1');
  text = text.replace(/~~([\s\S]*?)~~/g, '$1');
  text = text.replace(/`([^`]*)`/g, '$1');

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Build the plain-data payload the share card renders.
 *
 * `messages` is the raw ChatPage message array; only user/assistant entries
 * become shareable lines (system prompts and compaction notices are skipped).
 */
export function buildSharePayload({ character, scene, persona, userData, messages }) {
  const entity = scene || character || null;
  const characterName = entity?.name || '角色';
  const personaName = persona?.name || userData?.username || userData?.nickname || '你';
  // `picture` is the entity's full portrait (立绘) and `avatar_picture` is the
  // small round crop. The card header shows the portrait; message rows show the
  // avatar. Each falls back to the other so neither can come up empty, and
  // `picture` is optional on create, so plenty of entities only have an avatar.
  const characterImage = resolveMediaUrl(entity?.picture);
  const characterAvatar =
    resolveMediaUrl(entity?.avatar_picture) || characterImage;
  const personaAvatar =
    resolveMediaUrl(persona?.avatar_picture || persona?.picture) ||
    resolveMediaUrl(userData?.profile_pic);
  const subtitle = scene ? (scene.intro || '') : (character?.tagline || '');

  const lines = (messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m, index) => {
      const isUser = m.role === 'user';
      return {
        id: m.message_id || `line-${index}`,
        role: m.role,
        author: isUser ? personaName : characterName,
        avatar: isUser ? personaAvatar : characterAvatar,
        // The raw Markdown body, untouched. The card renders it through the
        // chat's own pipeline so the screenshot matches the conversation.
        text: m.content,
        // One-line plain-text label for the picker in the dialog. Whitespace is
        // collapsed because the picker truncates rather than wraps.
        preview: stripMarkdownForShare(m.content).replace(/\s+/g, ' ').trim(),
      };
    })
    // Filtered on `preview` rather than `text`: a message whose body is nothing
    // but Markdown syntax renders to an empty card row even though it has a
    // non-empty `text`, which is exactly what this drop is for.
    .filter((line) => line.preview.length > 0);

  return {
    characterName,
    personaName,
    subtitle: String(subtitle || '').slice(0, 120),
    // Full portrait — null when the entity has no artwork, which makes the card
    // fall back to the compact avatar header.
    characterImage,
    characterAvatar,
    personaAvatar,
    lines,
  };
}
