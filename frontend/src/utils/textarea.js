/**
 * Shared textarea sizing helpers for the chat input.
 *
 * Both are driven by the same constants as the CSS max/min height so the
 * DOM write and the visual clamp can never disagree.
 */
import {
  CHAT_INPUT_BASE_HEIGHT,
  CHAT_INPUT_MAX_HEIGHT,
  CHAT_INPUT_INLINE_ACTIONS_PADDING,
} from './chatPageConstants';

// A single line is line-height + vertical padding tall, so anything that grows
// past the base height by more than rounding is already wrapped content.
const MULTILINE_TOLERANCE = 4;

const measureScrollHeight = (el) => {
  el.style.height = 'auto';
  return el.scrollHeight;
};

const countLines = (el) => (el.value ? el.value.split('\n').length : 1);

/**
 * Height the content needs because of its explicit line breaks.
 *
 * `scrollHeight` reports nothing for a trailing empty line, so a message that
 * ends with a newline (Shift+Enter on the last line) measures one line short:
 * the field would keep single-line height and hide the line the caret is on.
 *
 * @param {HTMLTextAreaElement} el
 * @param {number}              lines - line count from the textarea value
 * @returns {number} required height in px, padding included
 */
const linesHeight = (el, lines) => {
  const computed = window.getComputedStyle(el);
  const fontSize = parseFloat(computed.fontSize) || 16;
  const lineHeight = parseFloat(computed.lineHeight) || fontSize * 1.55;
  const paddingTop = parseFloat(computed.paddingTop) || 0;
  const paddingBottom = parseFloat(computed.paddingBottom) || 0;
  return paddingTop + paddingBottom + lines * lineHeight;
};

/**
 * Grow a textarea to fit its content, clamped between the base height and the
 * max height. Beyond the max, the textarea scrolls instead of growing further.
 *
 * @param {HTMLTextAreaElement|null} el
 * @param {string} [inlinePaddingRight] - trailing padding the one-line layout
 *        actually renders with. It has to match, because it decides where text
 *        wraps: measuring against a wider field than the visible one lets text
 *        wrap onto a second line while the composer still believes it is
 *        single-line, which leaves the tool row overlaying that line.
 * @returns {boolean} whether the content needs more than one line (wrapped text
 *                    or an explicit line break)
 */
export const resizeTextareaToContent = (el, inlinePaddingRight = CHAT_INPUT_INLINE_ACTIONS_PADDING) => {
  if (!el) return false;

  const lines = countLines(el);
  // Padding and line-height are read once: only `paddingRight` is mutated below.
  const linesRequiredHeight = linesHeight(el, lines);

  // Decide the layout against the one-line geometry, which is always the
  // narrower of the two. The tool-row layout would report fewer lines, letting
  // a borderline text flip the composer between the layouts on every keystroke.
  const currentPaddingRight = el.style.paddingRight;
  el.style.paddingRight = inlinePaddingRight;
  const inlineLayoutHeight = Math.max(measureScrollHeight(el), linesRequiredHeight);
  el.style.paddingRight = currentPaddingRight;

  const isMultiline =
    lines > 1 || inlineLayoutHeight > CHAT_INPUT_BASE_HEIGHT + MULTILINE_TOLERANCE;

  const contentHeight = Math.max(measureScrollHeight(el), linesRequiredHeight);
  el.style.height = `${Math.max(
    CHAT_INPUT_BASE_HEIGHT,
    Math.min(contentHeight, CHAT_INPUT_MAX_HEIGHT)
  )}px`;
  el.style.overflowY = contentHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';

  return isMultiline;
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
