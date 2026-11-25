import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCompactTokenCount, formatCreditCount } from '../utils/creditDisplay.js';

/**
 * 点数（credits）配额展示。
 *
 * Free users spend from a rolling pool that refills a fixed amount at every
 * round hour (+3 / hour) and banks up to a maximum (100). The pool therefore
 * never resets to zero — the row reads `每日点数  countdown  ⚡balance`,
 * popping a short "+3" whenever a refill lands and glowing while the pool is
 * full.
 *
 * Pro users keep the monthly progress bar, with the same bolt embedded at the
 * start of the bar so the two quota displays read as one system. The bar shows
 * only `每月点数` at rest; hovering over it reveals the used percentage, and the
 * exact numbers plus the reset date stay in the tooltip.
 */

const KEYFRAMES_ID = 'yb-credit-quota-keyframes';
const KEYFRAMES_CSS = `
@keyframes yb-credit-pop {
  0% { transform: scale(1); }
  35% { transform: scale(1.14); }
  100% { transform: scale(1); }
}
@keyframes yb-credit-gain {
  0% { opacity: 0; transform: translateY(5px) scale(0.86); }
  30% { opacity: 1; transform: translateY(0) scale(1); }
  70% { opacity: 0.9; transform: translateY(-4px) scale(1); }
  100% { opacity: 0; transform: translateY(-9px) scale(0.96); }
}
@keyframes yb-credit-full-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.0); }
  50% { box-shadow: 0 0 0 4px rgba(167, 139, 250, 0.24); }
}
`;

const LAVENDER = '#a78bfa';
const VIOLET = '#7c3aed';
const DEEP_VIOLET = '#5b2f9b';
const LABEL_COLOR = '#4f456c';

const useKeyframes = () => {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(KEYFRAMES_ID)) return;
    const style = document.createElement('style');
    style.id = KEYFRAMES_ID;
    style.textContent = KEYFRAMES_CSS;
    document.head.appendChild(style);
  }, []);
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

/** Credits are small floats; the sidebar/profile rows only show whole numbers. */
const formatWholeCredits = (value) => formatCreditCount(Math.round(toNumber(value)));

const formatCountdown = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

/**
 * Live countdown to the next quota refill / reset.
 * Returns null `text` when there is no upcoming refill (e.g. pool full).
 */
export const useQuotaCountdown = (targetIso) => {
  const target = useMemo(() => {
    const parsed = targetIso ? Date.parse(targetIso) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [targetIso]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
  }, [target]);

  useEffect(() => {
    if (target === null) return undefined;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [target]);

  if (target === null) return { text: null, expired: false };

  const secondsLeft = Math.max(0, Math.ceil((target - now) / 1000));
  return { text: formatCountdown(secondsLeft), expired: secondsLeft <= 0 };
};

const BoltIcon = ({ size = 15, dimmed = false, color = LAVENDER }) => (
  <i
    className="bi bi-lightning-charge-fill"
    aria-hidden="true"
    style={{
      fontSize: size,
      lineHeight: 1,
      color,
      display: 'inline-block',
      flexShrink: 0,
      opacity: dimmed ? 0.55 : 1,
      filter: dimmed ? 'none' : 'drop-shadow(0 1px 2px rgba(124, 58, 237, 0.28))',
    }}
  />
);

/** Pill metrics + number typography shared by every credit amount on screen, so
 *  the quota row and the wallet row line up. */
const pillGap = (isCompact) => (isCompact ? 4 : 6);
const pillPadding = (isCompact) => (isCompact ? '2px 7px 2px 3px' : '3px 9px 3px 5px');
const iconSize = (isCompact) => (isCompact ? 13 : 15);
const numberStyle = (isCompact, color) => ({
  fontSize: isCompact ? '0.8rem' : '0.95rem',
  fontWeight: 800,
  lineHeight: 1,
  color,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
});

/** Wallet balance, rendered with the same typography/padding as the quota. */
export const WalletCreditValue = ({ balance, size = 'md', title }) => {
  const isCompact = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: pillGap(isCompact),
        padding: pillPadding(isCompact),
        borderRadius: 999,
        border: '1px solid transparent',
      }}
      title={title ?? '钱包点数：充值获得，用不完不会过期'}
    >
      <i
        className="bi bi-wallet2"
        aria-hidden="true"
        style={{
          fontSize: iconSize(isCompact),
          lineHeight: 1,
          color: LAVENDER,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      <span style={numberStyle(isCompact, DEEP_VIOLET)}>
        {formatWholeCredits(balance)}
      </span>
    </span>
  );
};

/** The lavender bolt + balance, with the short refill pop/gain animations. */
const FreeCreditBalance = ({ balance, max, refillAmount, full, size }) => {
  const isCompact = size === 'sm';
  const previousRef = useRef(null);
  const [gain, setGain] = useState(null);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = balance;
    if (previous === null || balance === null) return;
    const delta = balance - previous;
    if (delta > 0.001) {
      setGain({ amount: Math.round(delta * 100) / 100, key: Date.now() });
    }
  }, [balance]);

  useEffect(() => {
    if (!gain) return undefined;
    const timeoutId = window.setTimeout(() => setGain(null), 700);
    return () => window.clearTimeout(timeoutId);
  }, [gain]);

  const balanceLabel = formatWholeCredits(balance);
  const maxLabel = formatCreditCount(max);

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: pillGap(isCompact),
        // Padding stays constant so the row does not shift when the pool fills;
        // only the pill's paint changes between the steady and full states.
        padding: pillPadding(isCompact),
        borderRadius: 999,
        background: full
          ? 'linear-gradient(135deg, rgba(167, 139, 250, 0.30) 0%, rgba(124, 58, 237, 0.20) 100%)'
          : 'transparent',
        border: full
          ? '1px solid rgba(124, 58, 237, 0.45)'
          : '1px solid transparent',
        animation: full ? 'yb-credit-full-glow 2.6s ease-in-out infinite' : 'none',
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}
      title={
        full
          ? `点数已满（上限 ${maxLabel}），用掉后每小时补充 ${formatCreditCount(refillAmount)} 点`
          : `免费点数：每小时补充 ${formatCreditCount(refillAmount)} 点，可积累至 ${maxLabel}`
      }
    >
      <BoltIcon size={iconSize(isCompact)} dimmed={!full && balance <= 0} />
      <span
        key={gain?.key ?? 'steady'}
        style={{
          ...numberStyle(isCompact, full ? VIOLET : DEEP_VIOLET),
          animation: gain ? 'yb-credit-pop 520ms ease' : 'none',
        }}
      >
        {balanceLabel}
      </span>
      {gain && (
        <span
          key={`gain-${gain.key}`}
          style={{
            position: 'absolute',
            right: 0,
            top: -8,
            fontSize: isCompact ? '0.65rem' : '0.72rem',
            fontWeight: 800,
            color: VIOLET,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            animation: 'yb-credit-gain 700ms ease forwards',
          }}
        >
          +{formatCreditCount(gain.amount)}
        </span>
      )}
    </span>
  );
};

/**
 * Quota meter for the signed-in user.
 *
 * Derives the display from the serialized user object and renders a label on the
 * left with the value group right-aligned (matching the wallet balance row):
 * - `credit_cap_scope === 'monthly'` → `每月点数` + progress bar with an embedded bolt
 *   (percentage appears on hover; exact numbers + reset date in the tooltip)
 * - otherwise → `每日点数` + bolt + balance + refill countdown
 */
const CreditQuotaMeter = ({
  user,
  size = 'md',
  className = '',
  style,
}) => {
  useKeyframes();
  const isCompact = size === 'sm';
  const isMonthly = user?.credit_cap_scope === 'monthly';

  const cap = toNumber(user?.credit_cap);
  const used = Math.max(0, toNumber(user?.used_credits));
  const maxAccumulation = toNumber(
    user?.free_credit_max_accumulation ?? user?.free_daily_credit_cap,
    isMonthly ? cap : 100
  );
  const rawBalance = user?.free_credit_balance;
  const balance = rawBalance === null || rawBalance === undefined
    ? Math.max(0, (isMonthly ? cap : maxAccumulation) - used)
    : toNumber(rawBalance);
  const refillAmount = toNumber(user?.free_credit_refill_amount, 3);

  const countdown = useQuotaCountdown(isMonthly ? null : user?.next_free_credit_refill_at);
  const [hovered, setHovered] = useState(false);

  if (isMonthly) {
    const percent = cap > 0 ? Math.min(100, Math.max(0, (used / cap) * 100)) : 0;
    const resetLabel = user?.credit_reset_at
      ? new Date(user.credit_reset_at).toLocaleDateString('zh-CN')
      : null;
    // The bar is tall enough to hold the bolt, which sits inside its start.
    const barHeight = isCompact ? 14 : 16;
    // The exact usage and reset date are kept out of the resting state; the bar
    // reveals the percentage on hover and the details live in the tooltip.
    const detailLabel = [
      cap > 0
        ? `已用 ${formatCompactTokenCount(Math.round(used))} / ${formatCompactTokenCount(Math.round(cap))}`
        : `已用 ${formatCompactTokenCount(Math.round(used))}`,
      resetLabel ? `${resetLabel} 重置` : null,
    ].filter(Boolean).join('，');
    return (
      <div
        className={className}
        style={style}
        title={detailLabel}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="d-flex align-items-center justify-content-between" style={{ marginBottom: isCompact ? 4 : 6, gap: 8 }}>
          <span style={{ fontSize: isCompact ? '0.72rem' : '0.82rem', fontWeight: 700, color: LABEL_COLOR, whiteSpace: 'nowrap' }}>
            每月点数
          </span>
          {/* Padding kept (without a background) so the percentage lines up with the wallet row below. */}
          <span
            className="d-inline-flex align-items-center"
            style={{ padding: pillPadding(isCompact), minHeight: isCompact ? 17 : 20 }}
          >
            <span
              style={{
                ...numberStyle(isCompact, DEEP_VIOLET),
                opacity: hovered ? 1 : 0,
                transition: 'opacity 0.15s ease',
              }}
            >
              {`${Math.round(percent)}%`}
            </span>
          </span>
        </div>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            height: barHeight,
            borderRadius: 999,
            background: 'rgba(167, 139, 250, 0.16)',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: `${percent}%`,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${LAVENDER} 0%, ${VIOLET} 100%)`,
              transition: 'width 0.25s ease',
            }}
          />
          <span
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              paddingLeft: isCompact ? 3 : 4,
            }}
          >
            <BoltIcon size={isCompact ? 9 : 10} color={DEEP_VIOLET} dimmed={percent <= 0} />
          </span>
        </div>
      </div>
    );
  }

  const full = maxAccumulation > 0 && balance >= maxAccumulation;

  return (
    <div
      className={`d-flex align-items-center justify-content-between ${className}`.trim()}
      style={{ gap: 8, ...style }}
    >
      <span style={{ fontSize: isCompact ? '0.72rem' : '0.82rem', fontWeight: 700, color: LABEL_COLOR, whiteSpace: 'nowrap' }}>
        每日点数
      </span>
      <span className="d-inline-flex align-items-center" style={{ gap: isCompact ? 6 : 9 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: isCompact ? '0.68rem' : '0.76rem',
            fontWeight: 700,
            color: full ? VIOLET : '#6b7280',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
          title={full ? '点数已满，等待使用' : '距离下一个整点补充的倒计时'}
        >
          {full ? '点数已满' : countdown.text ?? null}
        </span>
        <FreeCreditBalance
          balance={balance}
          max={maxAccumulation}
          refillAmount={refillAmount}
          full={full}
          size={isCompact ? 'sm' : 'md'}
        />
      </span>
    </div>
  );
};

export default CreditQuotaMeter;
