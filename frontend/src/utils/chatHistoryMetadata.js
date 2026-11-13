const CHAT_METADATA_FIELDS = [
  'chat_id',
  'character_id',
  'character_name',
  'character_picture',
  'scene_id',
  'scene_name',
  'scene_picture',
  'persona_id',
  'title',
  'active_branch_id',
  'is_pinned',
  'hidden_from_recent',
  'last_updated',
  'created_at',
  'character_deleted',
  'character_moderation_status',
];

export function toChatHistoryMetadata(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  return Object.fromEntries(
    CHAT_METADATA_FIELDS
      .filter((field) => Object.prototype.hasOwnProperty.call(entry, field))
      .map((field) => [field, entry[field]])
  );
}

export function stripChatHistoryMessages(userData) {
  if (!userData || typeof userData !== 'object' || !Array.isArray(userData.chat_history)) {
    return userData;
  }
  return {
    ...userData,
    chat_history: userData.chat_history.map(toChatHistoryMetadata),
  };
}
