/**
 * Onboarding tour completion flag.
 *
 * The flag is scoped per user id — a single browser-local flag would mean that
 * once anyone finishes/skips the tour, no other account (including a brand new
 * signup on the same browser) would ever see it.
 */
const ONBOARDING_KEY_PREFIX = 'onboarding_completed';

export function getOnboardingStorageKey(userId) {
  return userId ? `${ONBOARDING_KEY_PREFIX}:${userId}` : ONBOARDING_KEY_PREFIX;
}

export function isOnboardingCompleted(userId) {
  try {
    // Strict comparison: anything other than the literal 'true' counts as
    // "not completed" (guards against stale ''/'false' values).
    return localStorage.getItem(getOnboardingStorageKey(userId)) === 'true';
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(userId) {
  try {
    localStorage.setItem(getOnboardingStorageKey(userId), 'true');
  } catch {
    // Storage may be unavailable (private mode / disabled) — ignore.
  }
}
