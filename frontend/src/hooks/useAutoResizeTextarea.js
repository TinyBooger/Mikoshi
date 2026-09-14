import { useEffect } from 'react';
import { resizeTextareaToContent } from '../utils/textarea';

/**
 * Auto-resize the chat textarea and provide its change handler.
 *
 * The effect covers programmatic updates (e.g. voice-to-text transcription
 * results) that never fire an onChange event; the handler covers typing.
 *
 * @param {object}   params
 * @param {object}   params.textareaRef - ref to the textarea element
 * @param {string}   params.input       - controlled input value
 * @param {function} params.setInput    - setter for the input value
 * @returns {{ handleInputChange: function }}
 */
export function useAutoResizeTextarea({ textareaRef, input, setInput }) {
  useEffect(() => {
    resizeTextareaToContent(textareaRef.current);
  }, [input, textareaRef]);

  // Handle textarea input and auto-resize
  const handleInputChange = (e) => {
    setInput(e.target.value);
    // Auto-resize textarea
    resizeTextareaToContent(textareaRef.current);
  };

  return { handleInputChange };
}
