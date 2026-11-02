import React from 'react';
import { formatCreditCount } from '../utils/creditDisplay';

/**
 * Banner shown when the user has reached their credit limit.
 */
export function CreditLockedBanner({ creditLimits }) {
  const isPro = !!creditLimits?.is_pro;
  const broke = !!creditLimits?.broke;
  // Broke pros (monthly quota exhausted) fall back to the free daily bucket.
  const usingDailyScope = !isPro || broke;
  const scopeLabel = usingDailyScope ? '本日免费额度' : '本月剩余点数';
  const used =
    Number(
      creditLimits?.used_credits ??
        (creditLimits?.cap_scope === 'monthly'
          ? creditLimits?.monthly_credit_usage
          : creditLimits?.daily_credit_usage)
    ) || 0;
  const cap = Number(creditLimits?.credit_cap || 0);

  const reachInfo = `${formatCreditCount(used)} / ${formatCreditCount(cap)}`;

  const openTopUp = () => window.open('/credit-topup', '_blank', 'noopener,noreferrer');
  const openProUpgrade = () => window.open('/pro-upgrade', '_blank', 'noopener,noreferrer');

  const message = broke
    ? `本月聊天点数已用尽（${reachInfo}），已切换至每日免费点数`
    : cap > 0
      ? `${scopeLabel}已达上限（${reachInfo}）`
      : `${scopeLabel}已达上限，钱包点数已用尽`;

  return (
    <div
      style={{
        width: '100%',
        marginBottom: 8,
        padding: '0.4rem 0.65rem',
        borderRadius: 10,
        border: '1px solid rgba(124, 58, 237, 0.18)',
        background: 'rgba(124, 58, 237, 0.045)',
        fontSize: '0.72rem',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.35rem 0.5rem',
      }}
    >
      <i
        className="bi bi-info-circle"
        style={{ color: '#8b5cf6', fontSize: '0.8rem', flexShrink: 0 }}
      />
      <span style={{ flex: 1, minWidth: 140, color: '#6b7280', lineHeight: 1.4 }}>
        {message}
        {usingDailyScope && (
          <span style={{ color: '#a1a1aa' }}> · 每日 12:00 重置</span>
        )}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={openTopUp}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(124, 58, 237, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.3)';
          }}
          style={{
            padding: '0.15rem 0.6rem',
            borderRadius: 999,
            border: '1px solid rgba(124, 58, 237, 0.3)',
            background: 'transparent',
            color: '#6d28d9',
            fontSize: '0.7rem',
            fontWeight: 700,
            lineHeight: 1.5,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.16s ease, border-color 0.16s ease',
          }}
        >
          充值点数
        </button>
        {!isPro && (
          <button
            type="button"
            onClick={openProUpgrade}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#6d28d9';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#7c3aed';
            }}
            style={{
              padding: '0.15rem 0.6rem',
              borderRadius: 999,
              border: 'none',
              background: '#7c3aed',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              lineHeight: 1.5,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.16s ease',
            }}
          >
            升级 Pro
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * Banner shown when the user is fully banned.
 */
export function BanBanner({ userData }) {
  return (
    <div
      style={{
        width: '100%',
        marginBottom: 8,
        padding: '0.55rem 0.75rem',
        borderRadius: 10,
        border: '1px solid #fca5a5',
        background: '#fff1f2',
        color: '#b91c1c',
        fontSize: '0.8rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <i className="bi bi-slash-circle-fill" />
      <span>
        您的账号已被封禁，无法发送消息。
        {userData?.ban_until &&
          `封禁将于 ${new Date(userData.ban_until).toLocaleDateString()} 解除。`}
      </span>
    </div>
  );
}
