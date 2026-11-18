/**
 * Pure helpers for advanced-chat (model / generation parameter) configuration.
 *
 * Extracted verbatim from ChatPage.jsx — no React dependencies, safe to unit
 * test in isolation.
 */

import { getModelConfig, ALLOWED_MODEL_SET } from './modelConfigs';
import {
  SHARED_TOKEN_LIMITS,
  SHARED_TOKEN_TIERS,
  DEFAULT_ADVANCED_CHAT_CONFIG,
} from './chatPageConstants';

/**
 * Return token tiers allowed by the model's `maxOutputTokens`.
 * `getModelConfig` never returns null — it falls back to the most constrained
 * model — so the list is always non-empty and callers can safely read `[0]`.
 */
export const getTokenTiers = (modelId) => {
  const { maxOutputTokens } = getModelConfig(modelId);
  return SHARED_TOKEN_TIERS.filter((t) => t.value <= maxOutputTokens);
};

const nearestTierValue = (tiers, target) => tiers.reduce((nearest, tier) => (
  Math.abs(tier.value - target) < Math.abs(nearest.value - target) ? tier : nearest
), tiers[0]).value;

/**
 * Bounds are derived from the same model-filtered tier list the picker uses,
 * so `min`/`max`/`defaultValue` can never describe a value the UI cannot pick.
 */
export const getTokenLimits = (modelId) => {
  const tiers = getTokenTiers(modelId);
  return {
    min: SHARED_TOKEN_LIMITS.min,
    max: tiers[tiers.length - 1].value,
    defaultValue: nearestTierValue(tiers, SHARED_TOKEN_LIMITS.defaultValue),
  };
};

export const clamp = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const normalizeTokenTierValue = (modelName, rawValue) => {
  const tokenLimits = getTokenLimits(modelName);
  const clamped = clamp(rawValue, tokenLimits.min, tokenLimits.max, tokenLimits.defaultValue);
  return nearestTierValue(getTokenTiers(modelName), clamped);
};

export const normalizeChatModel = (modelName) => (ALLOWED_MODEL_SET.has(modelName) ? modelName : DEFAULT_ADVANCED_CHAT_CONFIG.model);
