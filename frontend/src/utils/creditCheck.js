/**
 * Unified Credit Check Utility
 *
 * Credit consumption order:
 *   1. Daily/monthly quota (free users: daily; pro users: monthly)
 *   2. Wallet credits (purchased_credit_balance)
 *   3. No balance → locked
 *
 * This mirrors the backend `can_consume_credits()` logic:
 *   blocked = cap_reached && !wallet_available
 *   consume_from_wallet = cap_reached && wallet_available
 */

/**
 * @typedef {Object} CreditLimits
 * @property {boolean} cap_reached - Whether daily/monthly quota is exhausted
 * @property {number} purchased_credit_balance - Wallet credit balance
 * @property {number} remaining_credits - Remaining quota credits (0 when cap_reached)
 * @property {boolean} is_limited - Whether a cap is enforced
 * @property {string} cap_scope - "daily" or "monthly"
 * @property {number} daily_credit_usage - Credits used today
 * @property {number} monthly_credit_usage - Credits used this month
 * @property {number} credit_cap - The cap value
 * @property {boolean} is_pro - Whether user is Pro
 * @property {string} plan - "free" or "pro"
 * @property {string} reset_at - ISO timestamp when quota resets
 */

/**
 * Check whether the user is fully locked (no credits available from any source).
 *
 * Locked = quota is exhausted AND wallet is empty.
 *
 * @param {CreditLimits|null|undefined} creditLimits
 * @returns {boolean}
 */
export const isCreditLocked = (creditLimits) => {
  if (!creditLimits) return false;
  const capReached = !!creditLimits.cap_reached;
  const walletBalance = Number(creditLimits.purchased_credit_balance || 0);
  return capReached && walletBalance <= 0;
};

/**
 * Check whether credits should be consumed from wallet (quota exhausted but wallet has funds).
 *
 * @param {CreditLimits|null|undefined} creditLimits
 * @returns {boolean}
 */
export const shouldConsumeFromWallet = (creditLimits) => {
  if (!creditLimits) return false;
  const capReached = !!creditLimits.cap_reached;
  const walletBalance = Number(creditLimits.purchased_credit_balance || 0);
  return capReached && walletBalance > 0;
};

/**
 * Get the effective remaining credits considering both quota and wallet.
 * When quota is not exhausted, returns quota + wallet.
 * When quota is exhausted, returns only wallet.
 *
 * @param {CreditLimits|null|undefined} creditLimits
 * @returns {{ quotaRemaining: number, walletBalance: number, effectiveTotal: number, capReached: boolean, isLocked: boolean, consumeFromWallet: boolean }}
 */
export const getCreditStatus = (creditLimits) => {
  if (!creditLimits) {
    return {
      quotaRemaining: 0,
      walletBalance: 0,
      effectiveTotal: 0,
      capReached: false,
      isLocked: false,
      consumeFromWallet: false,
    };
  }

  const capReached = !!creditLimits.cap_reached;
  const walletBalance = Number(creditLimits.purchased_credit_balance || 0);
  const quotaRemaining = Number(creditLimits.remaining_credits || 0);
  const hasWallet = walletBalance > 0;

  // Only locked when quota is exhausted AND wallet is empty
  const isLocked = capReached && !hasWallet;

  // When quota exhausted but wallet has funds, consume from wallet
  const consumeFromWallet = capReached && hasWallet;

  // Effective remaining: quota first, then wallet
  // If cap not reached, user has quota + wallet
  // If cap reached, user only has wallet
  const effectiveTotal = capReached ? walletBalance : quotaRemaining + walletBalance;

  return {
    quotaRemaining,
    walletBalance,
    effectiveTotal,
    capReached,
    isLocked,
    consumeFromWallet,
  };
};

export default getCreditStatus;
