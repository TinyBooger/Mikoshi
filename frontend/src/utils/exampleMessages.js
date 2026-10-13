export const EXAMPLE_MESSAGE_MAX_LENGTH = 2000;

export const normalizeExampleMessage = (message) => {
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    return message.filter((value) => typeof value === 'string').join('\n\n');
  }
  return '';
};
