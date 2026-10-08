// Helpers for resolving the {{char}} / {{user}} placeholders that creators can
// use inside character-authored text (the 角色设定 description, example
// dialogue, greetings, ...).

// Fallback used for {{user}} when the active persona has no name. The user's
// account name / nickname is intentionally never used, and no attempt is made
// to guess a pronoun ("你") since that reads wrong in many contexts.
export const USER_PLACEHOLDER_FALLBACK = '用户';

const CHAR_PLACEHOLDER_RE = /\{\{\s*char\s*\}\}/gi;
const USER_PLACEHOLDER_RE = /\{\{\s*user\s*\}\}/gi;
// Non-global twin: a /g regex is stateful under .test(), which would make
// repeated calls alternate between true/false.
const USER_PLACEHOLDER_TEST_RE = /\{\{\s*user\s*\}\}/i;

/**
 * Resolve the name used for the {{user}} placeholder.
 * The persona name wins; otherwise fall back to a generic label.
 *
 * @param {string|null|undefined} personaName active user-persona name
 * @returns {string}
 */
export function resolveUserPlaceholderName(personaName) {
  const name = typeof personaName === 'string' ? personaName.trim() : '';
  return name || USER_PLACEHOLDER_FALLBACK;
}

/**
 * Replace {{char}} / {{user}} placeholders in character-authored text.
 *
 * @param {string|null|undefined} text
 * @param {string|null|undefined} characterName
 * @param {string|null|undefined} personaName active user-persona name
 * @returns {string|null|undefined} text with placeholders resolved
 */
export function applyCharacterPlaceholders(text, characterName, personaName) {
  if (typeof text !== 'string' || text === '') return text;
  const charName = typeof characterName === 'string' ? characterName.trim() : '';
  const userName = resolveUserPlaceholderName(personaName);
  return text
    .replace(CHAR_PLACEHOLDER_RE, charName)
    .replace(USER_PLACEHOLDER_RE, userName);
}

/**
 * Whether a string contains a {{user}} placeholder.
 *
 * @param {unknown} text
 * @returns {boolean}
 */
export function hasUserPlaceholder(text) {
  return typeof text === 'string' && USER_PLACEHOLDER_TEST_RE.test(text);
}

/**
 * Whether any character-authored text relies on the {{user}} placeholder.
 * Used to nudge users without a persona to set one up.
 *
 * @param {object|null|undefined} character
 * @returns {boolean}
 */
export function characterUsesUserPlaceholder(character) {
  if (!character || typeof character !== 'object') return false;
  const greetings = Array.isArray(character.greetings) ? character.greetings.join('\n') : '';
  return (
    hasUserPlaceholder(character.description) ||
    hasUserPlaceholder(character.example_messages) ||
    hasUserPlaceholder(character.greeting) ||
    hasUserPlaceholder(greetings)
  );
}
