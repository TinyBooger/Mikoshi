export function buildSystemMessage(persona, exampleMessages) {
  return `You are the following persona:
${persona}

Here are example conversations demonstrating how you should behave:
${exampleMessages}

Stay consistent with this persona and style in your responses.`;
}
