/**
 * Shared textarea sizing helpers for the chat input.
 *
 * Both are driven by the same constants as the CSS max/min height so the
 * DOM write and the visual clamp can never disagree.
 */
import { CHAT_INPUT_BASE_HEIGHT, CHAT_INPUT_MAX_HEIGHT } from './chatPageConstants';

/**
 * Grow a textarea to fit its content, clamped between the base height and the
 * max height. Beyond the max, the textarea scrolls instead of growing further.
 *
 * @param {HTMLTextAreaElement|null} el
 */
export const resizeTextareaToContent = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  const newHeight = Math.max(
    CHAT_INPUT_BASE_HEIGHT,
    Math.min(el.scrollHeight, CHAT_INPUT_MAX_HEIGHT)
  );
  el.style.height = `${newHeight}px`;
  el.style.overflowY = el.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
};

/**
 * Collapse a textarea back to the base height (used after sending, when the
 * input is cleared and the box should shrink immediately).
 *
 * @param {HTMLTextAreaElement|null} el
 */
export const resetTextareaHeight = (el) => {
  if (!el) return;
  el.style.height = `${CHAT_INPUT_BASE_HEIGHT}px`;
  el.style.overflowY = 'hidden';
};
