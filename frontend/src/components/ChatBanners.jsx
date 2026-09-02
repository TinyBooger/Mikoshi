import React from 'react';
import { useNavigate } from 'react-router';
import { formatCreditCount } from '../utils/creditDisplay';

/**
 * Banner shown when the user has reached their credit limit.
 */
export function CreditLockedBanner({ creditLimits }) {
  const navigate = useNavigate();
  const isPro = !!creditLimits?.is_pro;
  const broke = !!creditLimits?.broke;
  // Broke pros (monthly quota exhausted) fall back to the free daily bucket.
  const usingDailyScope = !isPro || broke;
  const scopeLabel = usingDailyScope ? '本日剩余点数' : '本月剩余点数';
  const used =
    Number(
      creditLimits?.used_credits ??
        (creditLimits?.cap_scope === 'monthly'
          ? creditLimits?.monthly_credit_usage
          : creditLimits?.daily_credit_usage)
    ) || 0;
  const cap = Number(creditLimits?.credit_cap || 0);

  return (
    <div
      style={{
        width: '100%',
        marginBottom: 8,
        padding: '0.45rem 0.65rem',
        borderRadius: 10,
        border: '1px solid #fecaca',
        background: '#fff1f2',
        color: '#b91c1c',
        fontSize: '0.74rem',
        fontWeight: 600,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span>
            {scopeLabel}已达上限：{formatCreditCount(used)} /{' '}
            {formatCreditCount(cap)}
            {broke ? '，本月Pro点数已用尽，已切换至每日免费点数。' : '，'}钱包点数已用尽。
            可{isPro ? '购买点数包' : '升级Pro或购买点数包'}继续使用。
          </span>
          {usingDailyScope && (
            <span style={{ fontSize: '0.68rem', fontWeight: 500, opacity: 0.8 }}>
              点数将于每日中午12:00重置
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => navigate('/pro-upgrade')}
            style={{
              padding: '0.15rem 0.55rem',
              borderRadius: 6,
              border: 'none',
              background: '#111827',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            充值点数
          </button>
          {!creditLimits?.is_pro && (
            <button
              type="button"
              onClick={() => navigate('/pro-upgrade')}
              style={{
                padding: '0.15rem 0.55rem',
                borderRadius: 6,
                border: 'none',
                background: '#b91c1c',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              升级 Pro
            </button>
          )}
        </div>
      </div>
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
