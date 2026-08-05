import React from 'react';
import { useNavigate } from 'react-router';
import { formatCompactTokenCount } from '../utils/creditDisplay';

/**
 * Banner shown when the user has reached their credit limit.
 */
export function CreditLockedBanner({ creditLimits }) {
  const navigate = useNavigate();
  const isPro = !!creditLimits?.is_pro;
  const scopeLabel = isPro ? '本月剩余点数' : '本日剩余点数';
  const used =
    Number(
      creditLimits?.cap_scope === 'monthly'
        ? creditLimits?.monthly_credit_usage
        : creditLimits?.daily_credit_usage
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
        <span>
          {scopeLabel}已达上限：{formatCompactTokenCount(used)} /{' '}
          {formatCompactTokenCount(cap)}，钱包点数已用尽。可升级Pro或购买点数包继续使用。
        </span>
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
