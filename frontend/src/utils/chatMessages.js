/**
 * Pure helpers for chat message/error/wallpaper handling.
 *
 * Extracted verbatim from ChatPage.jsx — no React dependencies.
 */

import { WALLPAPER_OPTIONS } from './chatPageConstants';
import { resolveBackgroundPresetId } from './backgroundPresets';

export const getChatErrorMessage = (errorPayload) => {
  if (errorPayload?.error === 'ACCOUNT_BANNED') {
    const until = errorPayload?.ban_until
      ? `，封禁将于 ${new Date(errorPayload.ban_until).toLocaleDateString()} 解除`
      : '，该封禁为永久封禁';
    return `您的账号已被封禁${until}，无法发送消息。`;
  }
  if (errorPayload?.error === 'CREDIT_CAP_REACHED') {
    return errorPayload?.message || '已达到点数额度上限，当前点数相关操作已受限。';
  }
  if (errorPayload?.error === 'DAILY_MESSAGE_CAP_REACHED') {
    const remaining = Number(errorPayload?.limits?.remaining_messages ?? 0);
    if (remaining <= 0) {
      return '已达到今日消息上限，请明天再试，或升级 Pro 解锁无限消息。';
    }
    return errorPayload?.message || '已达到今日消息上限。';
  }
  if (typeof errorPayload?.error === 'string') {
    return errorPayload.error;
  }
  return 'Failed to send message. Please try again.';
};

export const compactMessagesForRequest = (allMessages) => {
  if (!Array.isArray(allMessages)) return [];

  return allMessages.filter(
    (message) => message && typeof message === 'object' && message.role && typeof message.content === 'string'
  );
};

/**
 * Resolve the raw `{ id, url }` wallpaper selection into the object the UI
 * actually renders.
 *
 * A selection with no `url` is a preset (or "none"), looked up by id in
 * WALLPAPER_OPTIONS; ids retired in favour of a gradient are aliased first so
 * older characters keep a background. Anything unknown falls back to the first
 * option ('none').
 *
 * The returned object always carries a `kind` — 'none' | 'gradient' | 'image' —
 * which is what the chat surface switches on. Do not test `url` for "is there a
 * background": gradient presets have none.
 */
export const getSelectedWallpaper = (wallpaper) => {
  if (wallpaper.id === 'none' || !wallpaper.url) {
    const preset = WALLPAPER_OPTIONS.find((o) => o.id === resolveBackgroundPresetId(wallpaper.id));
    return preset || WALLPAPER_OPTIONS[0];
  }
  return { id: wallpaper.id, kind: 'image', url: wallpaper.url, css: null };
};
