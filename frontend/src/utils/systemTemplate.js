export function buildSystemMessage(characterPersona, exampleMessages, userPersona = null, scene = null) {
  return `You are the following persona:
${characterPersona}

Here are example conversations demonstrating how you should behave:
${exampleMessages}

Stay consistent with this persona and style in your responses.

${userPersona ? `The user is the following persona:\n${userPersona}\n` : ''}

${scene ? `The current scene is:\n${scene}\n` : ''}`
;
}
