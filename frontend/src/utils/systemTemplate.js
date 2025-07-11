export function buildSystemMessage(characterPersona, exampleMessages, userPersona = null) {
  return `You are the following persona:
${characterPersona}

${userPersona ? `The user is pretending to be this persona:\n${userPersona}\n` : ''}

Here are example conversations demonstrating how you should behave:
${exampleMessages}

Stay consistent with this persona and style in your responses.`;
}
