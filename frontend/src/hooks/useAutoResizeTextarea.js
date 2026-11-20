import { useCallback, useEffect, useState } from 'react';
import { resizeTextareaToContent } from '../utils/textarea';

/**
 * Auto-resize the chat textarea and provide its change handler.
 *
 * The effect covers programmatic updates (e.g. voice-to-text transcription
 * results) that never fire an onChange event; the handler covers typing.
 *
 * `isMultiline` mirrors whether the content needs more than one line, which the
 * composer uses to move its action buttons from the inline overlay to their own
 * row. Two things have to re-measure when they change: the input value, and the
 * trailing padding of the one-line layout, since the actions (and the recording
 * waveform beside them) live in that reserved space and therefore decide where
 * the text wraps.
 *
 * @param {object}   params
 * @param {object}   params.textareaRef      - ref to the textarea element
 * @param {string}   params.input            - controlled input value
 * @param {function} params.setInput         - setter for the input value
 * @param {string}   params.inlinePaddingRight - trailing padding rendered by the
 *                                               one-line layout; the field is
 *                                               measured against this same width
 * @returns {{ handleInputChange: function, isMultiline: boolean }}
 */
export function useAutoResizeTextarea({ textareaRef, input, setInput, inlinePaddingRight }) {
  const [isMultiline, setIsMultiline] = useState(false);

  const syncTextarea = useCallback(() => {
    setIsMultiline(resizeTextareaToContent(textareaRef.current, inlinePaddingRight));
  }, [textareaRef, inlinePaddingRight]);

  useEffect(() => {
    syncTextarea();
  }, [input, isMultiline, syncTextarea]);

  // Handle textarea input and auto-resize
  const handleInputChange = (e) => {
    setInput(e.target.value);
    // Auto-resize textarea
    syncTextarea();
  };

  return { handleInputChange, isMultiline };
}
