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
        // Send time, used for the card's time dividers. Absent on messages the
        // backend could not vouch for, which is why the card must tolerate it
        // being null (see `buildTranscriptDividers`).
        created_at: m.created_at || null,
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

/**
 * Build the plain-data payload the character card renders.
 *
 * There are no messages here: this card promotes the entity itself, so it
 * carries identity, tags, creator, counters, and the URL its QR code encodes.
 * Everything is optional-tolerant because ChatPage hands over the lighter
 * character object it already holds in state — that one has no `views`/`likes`,
 * and a zero is dropped rather than printed as a stat nobody has.
 */
export function buildCharacterSharePayload({ entity, type, id }) {
  const name = entity?.name || '角色';
  const entityType = type || 'character';
  // `picture` is the full portrait (立绘); `avatar_picture` is the round crop.
  const portrait = resolveMediaUrl(entity?.picture);
  const avatar = resolveMediaUrl(entity?.avatar_picture) || portrait;
  // Scenes carry their blurb in `intro`, characters in `tagline`; `description`
  // is the last resort for personas, which have no `tagline`/`intro`. It is
  // never used for characters, whose `description` is long-form role settings.
  const tagline = String(
    entity?.tagline ||
    entity?.intro ||
    (entityType === 'character' ? '' : entity?.description) ||
    '',
  ).trim();
  const tags = (Array.isArray(entity?.tags) ? entity.tags : [])
    .map((tag) => (tag && typeof tag === 'object' ? tag.name : tag))
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const entityId = id ?? entity?.id ?? null;

  return {
    name,
    tagline: tagline.slice(0, 140),
    tags,
    portrait,
    avatar,
    creatorName: String(entity?.creator_name || '').trim(),
    likes: Number.isFinite(entity?.likes) ? entity.likes : null,
    views: Number.isFinite(entity?.views) ? entity.views : null,
    // The QR target. `entityId` is absent only for an entity that failed to
    // load, where the dialog is not opened at all.
    url: entityId != null
      ? `${window.location.origin}/${entityType}/${entityId}`
      : window.location.origin,
  };
}
