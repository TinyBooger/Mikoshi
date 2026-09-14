/**
 * Clipboard helpers.
 */

/**
 * Copy `text` to the clipboard.
 *
 * Prefers the async Clipboard API and falls back to a hidden textarea +
 * `document.execCommand('copy')` for contexts where it isn't available
 * (non-HTTPS origins, older browsers).
 *
 * Never throws — callers decide how to surface a failure.
 *
 * @param {string} text
 * @returns {Promise<boolean>} Whether the copy succeeded.
 */
export const copyTextToClipboard = async (text) => {
  if (typeof text !== 'string' || !text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    return true;
  } catch (error) {
    console.error('Failed to copy text to clipboard:', error);
    return false;
  }
};
