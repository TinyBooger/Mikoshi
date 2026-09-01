/**
 * Frontend mirror of backend/model_configs.py.
 *
 * Only the fields needed for UI filtering are included:
 *  - maxOutputTokens  → caps the "max_tokens" reply-length picker
 *  - contextLength    → caps the context-window tier picker
 *  - multiplier       → cost multiplier relative to qwen-plus-character (1x)
 */

const MODEL_CONFIGS = [
  // Qwen Character
  { id: "qwen-plus-character", maxOutputTokens: 4_000,  contextLength: 32_000,    multiplier: 1.0, description: "专为角色扮演优化" },
  { id: "qwen-flash-character",maxOutputTokens: 4_000,  contextLength: 8_000,     multiplier: 0.3, description: "角色扮演优化,便宜" },

  // DeepSeek
  { id: "deepseek-v4-pro",    maxOutputTokens: 384_000, contextLength: 1_000_000, multiplier: 5.6, description: "推理能力强，适合复杂角色" },
  { id: "deepseek-v4-flash",  maxOutputTokens: 384_000, contextLength: 1_000_000, multiplier: 1.9 },

  // Qwen
  { id: "qwen3.7-plus",        maxOutputTokens: 64_000, contextLength: 1_000_000, multiplier: 2.5, description: "表现全面" },
  { id: "qwen3.7-flash",       maxOutputTokens: 128_000, contextLength: 1_000_000, multiplier: 0.25, description: "便宜" },

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
 * Return the cost multiplier for *modelId* (relative to qwen-plus-character = 1x).
 */
export function getModelMultiplier(modelId) {
  return getModelConfig(modelId).multiplier ?? 1.0;
}

/**
 * Return the short description for *modelId*, or undefined when none is set.
 */
export function getModelDescription(modelId) {
  return getModelConfig(modelId).description;
}

/**
 * The canonical list of known model ids (for select dropdowns, validation, etc.).
 */
export const AVAILABLE_MODEL_IDS = MODEL_CONFIGS.map((m) => m.id);
export const ALLOWED_MODEL_SET = new Set(AVAILABLE_MODEL_IDS);

export default MODEL_CONFIGS;
