import { useEffect, useState } from 'react';

/**
 * One-shot heads-up shown to mobile users, pointing at the chat settings
 * button. Appears when the viewport becomes mobile and auto-hides after
 * `duration` ms; desktop always hides it.
 *
 * @param {boolean} isMobile
 * @param {number}  duration - ms to keep the hint visible
 * @returns {{ showChatSettingsHint: boolean, hideChatSettingsHint: function }}
 */
export function useChatSettingsHint(isMobile, duration = 3000) {
  const [showChatSettingsHint, setShowChatSettingsHint] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setShowChatSettingsHint(false);
      return undefined;
    }

    setShowChatSettingsHint(true);
    const hideTimer = setTimeout(() => setShowChatSettingsHint(false), duration);
    return () => clearTimeout(hideTimer);
  }, [isMobile, duration]);

  const hideChatSettingsHint = () => setShowChatSettingsHint(false);

  return { showChatSettingsHint, hideChatSettingsHint };
}
