/**
 * The 对话历史 list mirrors the current entry mode so that picking an entry
 * never silently switches modes:
 *   scene mode     → every chat that used this scene, whichever character
 *   character mode → only the scene-less chats with this character (a chat
 *                    that has a scene belongs to its scene group instead)
 *   otherwise      → every chat with this character
 * Entries hidden from 最近对话 are never listed.
 *
 * Shared with the post-delete fallback, which must pick from exactly the same
 * set: a fallback outside this list would replace the deleted chat with one the
 * user cannot see in 对话历史.
 *
 * @param {Array}  chatHistory - `userData.chat_history`
 * @param {object} mode
 * @param {object} [mode.selectedCharacter]
 * @param {object} [mode.selectedScene]
 * @param {string} [mode.characterId]
 * @returns {Array} matching chats, most recently updated first
 */
export function selectChatHistoryForMode(chatHistory, { selectedCharacter, selectedScene, characterId } = {}) {
  const history = (chatHistory || []).filter((chat) => !chat?.hidden_from_recent);
  const isSceneMode = !!selectedScene;
  const isCharacterMode = !isSceneMode && !!selectedCharacter;
  let filtered;
  if (isSceneMode) {
    filtered = history.filter((chat) => String(chat.scene_id) === String(selectedScene.id));
  } else if (isCharacterMode) {
    filtered = history.filter((chat) => !chat.scene_id && String(chat.character_id) === String(selectedCharacter.id));
  } else {
    filtered = history.filter((chat) => String(chat.character_id) === String(characterId));
  }
  return filtered.slice().sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
}
