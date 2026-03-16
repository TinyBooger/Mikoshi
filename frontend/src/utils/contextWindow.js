export const DEFAULT_CONTEXT_WINDOW_TIER = '3k';

const CONTEXT_WINDOW_TIERS = [
  { key: '3k', tokens: 3000, proOnly: false },
  { key: '6k', tokens: 6000, proOnly: false },
  { key: '12k', tokens: 12000, proOnly: false },
  { key: '24k', tokens: 24000, proOnly: true },
  { key: '32k', tokens: 32000, proOnly: true },
];

export const getContextWindowTierOptions = ({ canUseAdvancedConfig, isProUser }) => {
  if (!canUseAdvancedConfig) {
    return CONTEXT_WINDOW_TIERS.filter((tier) => tier.key === DEFAULT_CONTEXT_WINDOW_TIER);
  }

  return CONTEXT_WINDOW_TIERS.filter((tier) => !(tier.proOnly && !isProUser));
};

export const normalizeContextWindowTier = (rawTier, { canUseAdvancedConfig, isProUser }) => {
  const options = getContextWindowTierOptions({ canUseAdvancedConfig, isProUser });
  const requested = String(rawTier || '').trim().toLowerCase();
  const match = options.find((tier) => tier.key === requested);
  return (match || options[0] || { key: DEFAULT_CONTEXT_WINDOW_TIER }).key;
};

export const getContextWindowTokenLimit = (tierKey, { canUseAdvancedConfig, isProUser }) => {
  const normalizedTier = normalizeContextWindowTier(tierKey, { canUseAdvancedConfig, isProUser });
  const options = getContextWindowTierOptions({ canUseAdvancedConfig, isProUser });
  const match = options.find((tier) => tier.key === normalizedTier);
  return (match || options[0] || { tokens: 3000 }).tokens;
};
