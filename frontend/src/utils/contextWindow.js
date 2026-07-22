import { getModelConfig } from './modelConfigs';

export const DEFAULT_CONTEXT_WINDOW_TIER = '8k';

const CONTEXT_WINDOW_TIERS = [
  { key: '8k',   tokens: 8000 },
  { key: '32k',  tokens: 32000 },
  { key: '128k', tokens: 128000 },
  { key: '256k', tokens: 256000 },
  { key: '512k', tokens: 512000 },
  { key: '1M',   tokens: 1000000 },
];

/**
 * Return all available context-window tier options.
 * Context window tiers are available to all users (free & pro).
 * Use {@link getFilteredContextWindowTierOptions} when you also need
 * model-cap filtering.
 */
export const getContextWindowTierOptions = () => {
  return [...CONTEXT_WINDOW_TIERS];
};

/**
 * Return context-window tier options filtered by the currently-selected
 * model's context-length cap.
 *
 * Tiers whose `tokens` exceed the model's context length are hidden.
 *
 * @param {string} [modelId]  e.g. "qwen-flash-character" — when omitted,
 *   model filtering is skipped.
 */
export const getFilteredContextWindowTierOptions = (modelId) => {
  const base = getContextWindowTierOptions();
  if (!modelId) return base;

  const modelCfg = getModelConfig(modelId);
  if (!modelCfg) return base;

  const maxContext = modelCfg.contextLength;
  return base.filter((tier) => tier.tokens <= maxContext);
};

export const normalizeContextWindowTier = (rawTier, modelId) => {
  const options = modelId
    ? getFilteredContextWindowTierOptions(modelId)
    : getContextWindowTierOptions();
  const requested = String(rawTier || '').trim().toLowerCase();
  const match = options.find((tier) => tier.key === requested);
  // Default to the max tier for the selected model (last option in filtered list)
  return (match || options[options.length - 1] || { key: DEFAULT_CONTEXT_WINDOW_TIER }).key;
};

export const getContextWindowTokenLimit = (tierKey) => {
  const normalizedTier = normalizeContextWindowTier(tierKey);
  const options = getContextWindowTierOptions();
  const match = options.find((tier) => tier.key === normalizedTier);
  return (match || options[options.length - 1] || { tokens: 8000 }).tokens;
};
