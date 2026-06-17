/**
 * Frontend mirror of backend/model_configs.py.
 *
 * Only the fields needed for UI filtering are included:
 *  - maxOutputTokens  → caps the "max_tokens" reply-length picker
 *  - contextLength    → caps the context-window tier picker
 *  - multiplier       → cost multiplier relative to deepseek-v4-flash (1x)
 */

const MODEL_CONFIGS = [
  // DeepSeek
  { id: "deepseek-v4-flash",  maxOutputTokens: 1_000_000, contextLength: 384_000, multiplier: 1.0 },
  { id: "deepseek-v4-pro",    maxOutputTokens: 1_000_000, contextLength: 384_000, multiplier: 3.0 },

  // Qwen
  { id: "qwen3.7-max",         maxOutputTokens: 64_000, contextLength: 1_000_000, multiplier: 12.0 },
  { id: "qwen3.7-plus",        maxOutputTokens: 64_000, contextLength: 1_000_000, multiplier: 2.0 },
  { id: "qwen3.6-flash",       maxOutputTokens: 64_000, contextLength: 1_000_000, multiplier: 1.2 },
  { id: "qwen-plus-character", maxOutputTokens: 4_000,  contextLength: 32_000,    multiplier: 0.8 },
  { id: "qwen-flash-character",maxOutputTokens: 4_000,  contextLength: 8_000,     multiplier: 0.3 },

  // Kimi
  { id: "kimi-k2.6",           maxOutputTokens: 16_000, contextLength: 256_000,   multiplier: 6.4 },

  // GLM
  { id: "glm-5.1",             maxOutputTokens: 128_000, contextLength: 200_000,  multiplier: 6.0 },

  // MiniMax
  { id: "MiniMax-M2.5",        maxOutputTokens: 128_000, contextLength: 200_000,  multiplier: 2.1 },
];

/** Fast lookup by model id. */
const MODEL_MAP = Object.fromEntries(
  MODEL_CONFIGS.map((m) => [m.id, m])
);

/**
 * Return the ModelConfig for *modelId*, or a safe default (deepseek-v4-flash).
 */
export function getModelConfig(modelId) {
  return MODEL_MAP[modelId] || MODEL_MAP["deepseek-v4-flash"];
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
