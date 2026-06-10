import { getModelConfig } from './modelConfigs';

export const DEFAULT_CONTEXT_WINDOW_TIER = '3k';

const CONTEXT_WINDOW_TIERS = [
  { key: '3k', tokens: 3000, proOnly: false },
  { key: '6k', tokens: 6000, proOnly: false },
  { key: '12k', tokens: 12000, proOnly: false },
  { key: '24k', tokens: 24000, proOnly: true },
  { key: '32k', tokens: 32000, proOnly: true },
];

/**
 * Return the base tier options filtered only by permissions (pro / advanced).
 * Use {@link getFilteredContextWindowTierOptions} when you also need
 * model-cap filtering.
 */
export const getContextWindowTierOptions = ({ canUseAdvancedConfig, isProUser }) => {
  if (!canUseAdvancedConfig) {
    return CONTEXT_WINDOW_TIERS.filter((tier) => tier.key === DEFAULT_CONTEXT_WINDOW_TIER);
  }

  return CONTEXT_WINDOW_TIERS.filter((tier) => !(tier.proOnly && !isProUser));
};

/**
 * Return context-window tier options filtered by *both* user permissions
 * and the currently-selected model's context-length cap.
 *
 * Tiers whose `tokens` exceed the model's context length are hidden.
 *
 * @param {{ canUseAdvancedConfig: boolean, isProUser: boolean }} perm
 * @param {string} [modelId]  e.g. "qwen-flash-character" — when omitted,
 *   model filtering is skipped.
 */
export const getFilteredContextWindowTierOptions = (perm, modelId) => {
  const base = getContextWindowTierOptions(perm);
  if (!modelId) return base;

  const modelCfg = getModelConfig(modelId);
  if (!modelCfg) return base;

  const maxContext = modelCfg.contextLength;
  return base.filter((tier) => tier.tokens <= maxContext);
};

export const normalizeContextWindowTier = (rawTier, { canUseAdvancedConfig, isProUser }, modelId) => {
  const options = modelId
    ? getFilteredContextWindowTierOptions({ canUseAdvancedConfig, isProUser }, modelId)
    : getContextWindowTierOptions({ canUseAdvancedConfig, isProUser });
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
