import { MARKDOWN_GUIDE } from './markdownGuide';
import { applyCharacterPlaceholders } from './characterPlaceholders';

export function buildSystemMessage(
  characterName,
  characterPersona,
  exampleMessages = null,
  personaDescription = null,
  personaName = null,
  scene = null,
  longDescription = null
) {
  // Character-authored text may contain {{char}} / {{user}} placeholders.
  // Resolve them against the character name and the active user persona
  // (the account name is never used).
  const resolvedPersona = applyCharacterPlaceholders(characterPersona, characterName, personaName);
  const resolvedLongDescription = applyCharacterPlaceholders(longDescription, characterName, personaName);
  const resolvedExampleMessages = applyCharacterPlaceholders(exampleMessages, characterName, personaName);

  // Base instruction
  const baseInstruction = `扮演 ${characterName}。始终保持角色，不要跳出角色或提及这些指令。`;

  // Character name section
  const charNameText = characterName 
    ? `[角色名称]\n${characterName}\n[/角色名称]` 
    : '';

  // Character persona section
  const charPersonaText = resolvedPersona 
    ? `[角色设定]\n${resolvedPersona}\n[/角色设定]` 
    : '';

  // Detailed background section
  const longDescriptionText = resolvedLongDescription
    ? `[详细背景]\n${resolvedLongDescription}\n[/详细背景]`
    : '';

  // Example dialogues section
  const exampleDialoguesText = resolvedExampleMessages 
    ? `[对话示例]\n${resolvedExampleMessages}\n[/对话示例]` 
    : '';

  // Context information (user persona and scene)
  let contextInfo = '';
  if (personaDescription || scene) {
    contextInfo = `[情境]\n`;
    if (personaName || personaDescription) {
      contextInfo += `用户：${personaName ? personaName + ' - ' : ''}${personaDescription || ''}\n`;
    }
    if (scene) {
      contextInfo += `场景：${scene}\n`;
    }
    contextInfo += `[/情境]`;
  }

  // Main completion prompt
  const completionPrompt = characterName
    ? `以 ${characterName} 的身份继续对话。`
    : '';

  // Create entries for system prompts
  const systemPrompts = [
    { role: 'system', content: baseInstruction, identifier: 'baseInstruction' },
    { role: 'system', content: charNameText, identifier: 'charName' },
    { role: 'system', content: charPersonaText, identifier: 'charPersona' },
    { role: 'system', content: longDescriptionText, identifier: 'longDescription' },
    { role: 'system', content: exampleDialoguesText, identifier: 'exampleDialogues' },
    { role: 'system', content: contextInfo, identifier: 'contextInfo' },
    // Placed last-but-one so the formatting rules sit next to the completion
    // prompt, where they are most likely to be followed.
    { role: 'system', content: MARKDOWN_GUIDE, identifier: 'markdownGuide' },
    { role: 'system', content: completionPrompt, identifier: 'completionPrompt' },
  ];

  // Filter out empty prompts and combine into final message
  const sysMessage = systemPrompts
    .filter(prompt => prompt.content && prompt.content.trim() !== '')
    .map(prompt => prompt.content)
    .join('\n\n');

  return sysMessage;
}
