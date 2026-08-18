/**
 * Frontend mirror of backend/model_configs.py.
 *
 * Only the fields needed for UI filtering are included:
 *  - maxOutputTokens  → caps the "max_tokens" reply-length picker
 *  - contextLength    → caps the context-window tier picker
 *  - multiplier       → cost multiplier relative to deepseek-v4-flash (1x)
 */

const MODEL_CONFIGS = [
  // Qwen Character
  { id: "qwen-plus-character", maxOutputTokens: 4_000,  contextLength: 32_000,    multiplier: 0.5 },
  { id: "qwen-flash-character",maxOutputTokens: 4_000,  contextLength: 8_000,     multiplier: 0.2 },

  // DeepSeek
  { id: "deepseek-v4-pro",    maxOutputTokens: 384_000, contextLength: 1_000_000, multiplier: 3.0 },
  { id: "deepseek-v4-flash",  maxOutputTokens: 384_000, contextLength: 1_000_000, multiplier: 1.0 },

  // Qwen
  { id: "qwen3.7-plus",        maxOutputTokens: 64_000, contextLength: 1_000_000, multiplier: 1.3 },
  { id: "qwen3.7-flash",       maxOutputTokens: 128_000, contextLength: 1_000_000, multiplier: 0.13 },

];

/** Fast lookup by model id. */
const MODEL_MAP = Object.fromEntries(
  MODEL_CONFIGS.map((m) => [m.id, m])
);

/**
 * Return the ModelConfig for *modelId*, or a safe default (deepseek-v4-flash).
 */
export function getModelConfig(modelId) {
  return MODEL_MAP[modelId] || MODEL_MAP["qwen-plus-character"];
}

/**
 * Return the cost multiplier for *modelId* (relative to deepseek-v4-flash = 1x).
 */
export function getModelMultiplier(modelId) {
  return getModelConfig(modelId).multiplier ?? 1.0;
}

/**
 * The canonical list of known model ids (for select dropdowns, validation, etc.).
 */
export const AVAILABLE_MODEL_IDS = MODEL_CONFIGS.map((m) => m.id);
export const ALLOWED_MODEL_SET = new Set(AVAILABLE_MODEL_IDS);

export default MODEL_CONFIGS;
