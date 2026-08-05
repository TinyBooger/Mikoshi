import { useRef } from 'react';
import { useToast } from '../components/ToastProvider';
import { isCreditLocked } from '../utils/creditCheck';

/**
 * Manages chat message limits and credit limit state, including
 * toast reminders when limits are approaching or reached.
 */
export function useCreditAndChatLimits() {
  const toast = useToast();
  const lastLimitReminderCountRef = useRef(null);
  const wasCreditLockedRef = useRef(false);

  const maybeShowMessageLimitReminder = (limits) => {
    if (!limits || !limits.is_limited || !limits.approaching_limit || limits.limit_reached) return;

    const currentCount = Number(limits.daily_message_count ?? 0);
    if (lastLimitReminderCountRef.current === currentCount) return;

    lastLimitReminderCountRef.current = currentCount;
    const remaining = Number(limits.remaining_messages ?? 0);
    const cap = Number(limits.daily_message_cap ?? 0);

    toast.show(
      `今日还可发送 ${remaining} 条消息（${currentCount}/${cap}）。升级 Pro 可解锁无限消息。`,
      { type: 'warning' }
    );
  };

  const applyChatLimits = (limits) => {
    if (!limits) return limits;
    maybeShowMessageLimitReminder(limits);
    return limits;
  };

  const maybeShowCreditLimitReminder = (limits) => {
    const locked = !!limits?.is_limited && isCreditLocked(limits);
    if (locked && !wasCreditLockedRef.current) {
      toast.show(limits.message || '已达到点数上限，当前与点数相关操作已受限。', { type: 'warning' });
    }
    wasCreditLockedRef.current = locked;
  };

  const applyCreditLimits = (limits) => {
    if (!limits) return limits;
    maybeShowCreditLimitReminder(limits);
    return limits;
  };

  return {
    maybeShowMessageLimitReminder,
    applyChatLimits,
    maybeShowCreditLimitReminder,
    applyCreditLimits,
  };
}
