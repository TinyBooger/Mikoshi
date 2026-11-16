// Helpers for resolving the {{char}} / {{user}} placeholders that creators can
// use inside character-authored text (the 角色设定 description, example
// dialogue, greetings, ...).

const CHAR_PLACEHOLDER_RE = /\{\{\s*char\s*\}\}/gi;
const USER_PLACEHOLDER_RE = /\{\{\s*user\s*\}\}/gi;

/**
 * Resolve the name used for the {{user}} placeholder.
 * The persona name wins; otherwise use the name shown on the user's profile.
 * Every account has a name, so no generic fallback is needed.
 *
 * @param {string|null|undefined} personaName active user-persona name
 * @param {string|null|undefined} profileName user's profile name
 * @returns {string}
 */
export function resolveUserPlaceholderName(personaName, profileName) {
  const persona = typeof personaName === 'string' ? personaName.trim() : '';
  if (persona) return persona;
  return typeof profileName === 'string' ? profileName.trim() : '';
}

/**
 * Replace {{char}} / {{user}} placeholders in character-authored text.
 *
 * @param {string|null|undefined} text
 * @param {string|null|undefined} characterName
 * @param {string|null|undefined} personaName active user-persona name
 * @param {string|null|undefined} profileName user's profile name
 * @returns {string|null|undefined} text with placeholders resolved
 */
export function applyCharacterPlaceholders(text, characterName, personaName, profileName) {
  if (typeof text !== 'string' || text === '') return text;
  const charName = typeof characterName === 'string' ? characterName.trim() : '';
  const userName = resolveUserPlaceholderName(personaName, profileName);
  return text
    .replace(CHAR_PLACEHOLDER_RE, charName)
    .replace(USER_PLACEHOLDER_RE, userName);
}
