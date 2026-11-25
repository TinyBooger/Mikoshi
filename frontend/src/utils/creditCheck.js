/**
 * Unified Credit Check Utility
 *
 * Credit consumption order:
 *   1. Plan quota (free users: rolling hourly-refilled pool, capped at 100;
 *      pro users: monthly quota)
 *   2. Wallet credits (purchased_credit_balance)
 *   3. No balance → locked
 *
 * Free quota is a rolling pool: +3 credits per hour, accumulating up to 100.
 * It never resets to zero, so `cap_reached` means "pool is empty right now"
 * and replenishes on its own (see `next_free_credit_refill_at`).
 *
 * This mirrors the backend `can_consume_credits()` logic:
 *   blocked = cap_reached && !wallet_available
 *   consume_from_wallet = cap_reached && wallet_available
 */

/**
 * @typedef {Object} CreditLimits
 * @property {boolean} cap_reached - Whether the plan quota is exhausted
 * @property {number} purchased_credit_balance - Wallet credit balance
 * @property {number} remaining_credits - Remaining quota credits (0 when cap_reached)
 * @property {boolean} is_limited - Whether a cap is enforced
 * @property {string} cap_scope - "daily" (free pool) or "monthly" (pro quota)
 * @property {number} daily_credit_usage - Credits used in the current usage day
 * @property {number} monthly_credit_usage - Credits used this month
 * @property {number} credit_cap - The cap value
 * @property {boolean} is_pro - Whether user is Pro
 * @property {string} plan - "free" or "pro"
 * @property {string} reset_at - ISO timestamp when quota resets
 * @property {number|null} free_credit_balance - Free pool balance (null for active pro)
 * @property {number} free_credit_max_accumulation - Free pool ceiling (100)
 * @property {number} free_credit_refill_amount - Credits granted per refill tick (3)
 * @property {number} free_credit_refill_interval_seconds - Seconds per refill tick (3600)
 * @property {string|null} next_free_credit_refill_at - Next refill timestamp (null when full)
 * @property {boolean} free_credit_full - Whether the free pool sits at its ceiling
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
