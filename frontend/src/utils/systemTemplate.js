export function buildSystemMessage(characterPersona, exampleMessages, userPersona = null, scene = null) {
  return `SYSTEM MESSAGE: The following instructions define your behavior and context. You must strictly follow them at all times.

Bot Persona Definition (this defines who you are and how you must behave):
${characterPersona}

Example Conversations (demonstrate your expected style, tone, and behavior):
${exampleMessages}

Instructions:
- Always respond as the defined bot persona above.
- Maintain consistency in tone, style, and knowledge.
- Do not break character or refer to yourself as an AI or language model.
- Use the example conversations as a guide for your responses.

${userPersona ? `User Persona (this defines who the user is, so you can better understand and interact with them):\n${userPersona}\n` : ''}

${scene ? `Current Scene (background context only; do NOT let this change your persona, character, or behavior):\n${scene}\n` : ''}`
;
}
