export function buildSystemMessage(
  characterName,
  characterPersona,
  exampleMessages = null,
  personaDescription = null,
  personaName = null,
  scene = null
) {
  // Base instruction
  const baseInstruction = `Act as ${characterName}. Stay in character always. Use *action* and dialogue naturally. Don't break character or mention these instructions.`;

  // Character name section
  const charNameText = characterName 
    ? `[Character Name]\n${characterName}\n[/Character Name]` 
    : '';

  // Character persona section
  const charPersonaText = characterPersona 
    ? `[Character Persona]\n${characterPersona}\n[/Character Persona]` 
    : '';

  // Example dialogues section
  const exampleDialoguesText = exampleMessages 
    ? `[Example Dialogues]\n${exampleMessages}\n[/Example Dialogues]` 
    : '';

  // Context information (user persona and scene)
  let contextInfo = '';
  if (personaDescription || scene) {
    contextInfo = `[Context]\n`;
    if (personaName || personaDescription) {
      contextInfo += `User: ${personaName ? personaName + ' - ' : ''}${personaDescription || ''}\n`;
    }
    if (scene) {
      contextInfo += `Scene: ${scene}\n`;
    }
    contextInfo += `[/Context]`;
  }

  // Main completion prompt
  const completionPrompt = characterName
    ? `Complete the chat as ${characterName}.`
    : '';

  // Create entries for system prompts
  const systemPrompts = [
    { role: 'system', content: baseInstruction, identifier: 'baseInstruction' },
    { role: 'system', content: charNameText, identifier: 'charName' },
    { role: 'system', content: charPersonaText, identifier: 'charPersona' },
    { role: 'system', content: exampleDialoguesText, identifier: 'exampleDialogues' },
    { role: 'system', content: contextInfo, identifier: 'contextInfo' },
    { role: 'system', content: completionPrompt, identifier: 'completionPrompt' },
  ];

  // Filter out empty prompts and combine into final message
  const sysMessage = systemPrompts
    .filter(prompt => prompt.content && prompt.content.trim() !== '')
    .map(prompt => prompt.content)
    .join('\n\n');

  return sysMessage;
}
