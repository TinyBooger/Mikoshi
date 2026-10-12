export const EXAMPLE_MESSAGE_COUNT = 3;
export const EXAMPLE_MESSAGE_MAX_LENGTH = 400;

export const normalizeExampleMessages = (messages) => {
  const values = Array.isArray(messages)
    ? messages
    : (typeof messages === 'string' ? [messages] : []);
  const normalized = values
    .slice(0, EXAMPLE_MESSAGE_COUNT)
    .filter((message) => typeof message === 'string');
  return normalized.length ? normalized : [''];
};
