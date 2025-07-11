// utils/systemTemplate.js
export function buildSystemMessage(persona, exampleMessages, userPersonas = []) {
  let systemMessage = `You are the following persona:
${persona}`;

  // Add user persona if provided
  if (userPersonas.length > 0) {
    const userPersona = userPersonas[0]; // Only one persona now
    systemMessage += `\n\nThe user is adopting this persona:
    
Persona: ${userPersona.name}
${userPersona.description}

Please adapt your responses accordingly.`;
  }

  systemMessage += `\n\nHere are example conversations demonstrating how you should behave:
${exampleMessages}

Stay consistent with this persona and style in your responses.`;

  return systemMessage;
}