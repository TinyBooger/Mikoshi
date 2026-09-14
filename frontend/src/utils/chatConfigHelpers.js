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

export const getTokenLimits = () => SHARED_TOKEN_LIMITS;

export const getTokenTiers = (modelId) => {
  const cfg = getModelConfig(modelId);
  if (!cfg) return SHARED_TOKEN_TIERS;
  return SHARED_TOKEN_TIERS.filter((t) => t <= cfg.maxOutputTokens);
};

export const clamp = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const normalizeTokenTierValue = (modelName, rawValue) => {
  const tokenLimits = getTokenLimits(modelName);
  const tiers = getTokenTiers(modelName);
  const clamped = clamp(rawValue, tokenLimits.min, tokenLimits.max, tokenLimits.defaultValue);
  return tiers.reduce((nearest, tier) => (
    Math.abs(tier - clamped) < Math.abs(nearest - clamped) ? tier : nearest
  ), tiers[0]);
};

export const normalizeChatModel = (modelName) => (ALLOWED_MODEL_SET.has(modelName) ? modelName : DEFAULT_ADVANCED_CHAT_CONFIG.model);
