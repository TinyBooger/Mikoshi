import { getModelConfig } from '../utils/modelConfigs';

/**
 * Derives context-window consumption for the current conversation, plus the
 * ready-to-render ring values used by the context window indicator.
 *
 * @param {object} params
 * @param {array}  params.messages                 - current message list
 * @param {object} params.advancedChatConfig       - active chat config (owns `model`)
 * @param {object} params.serverContextWindowUsage - server-reported usage, if any
 * @returns {{ contextWindowUsage, contextUsageRatio, contextUsagePercent, pieRadius, pieCircumference, pieStrokeOffset }}
 */
export function useContextWindowUsage({ messages, advancedChatConfig, serverContextWindowUsage }) {
  const getContextWindowUsage = (allMessages) => {
    // The context window is model-driven: it equals the selected model's
    // config, not a user-picked tier. Budget from the REAL per-request input
    // cap — some providers advertise a huge context window but cap input far
    // below it (qwen3.7-flash: 1M context / 32k maxInputTokens, mirrored from
    // backend max_input_tokens). Using contextLength alone would show ~3%
    // when the conversation is actually ~90% of the usable window.
    const modelCfg = getModelConfig(advancedChatConfig?.model || 'deepseek-v4-flash');
    const effectiveSoftTokenLimit = Math.min(
      modelCfg?.contextLength ?? 0,
      modelCfg?.maxInputTokens ?? modelCfg?.contextLength ?? 0,
    );

    if (!Array.isArray(allMessages)) {
      return {
        currentTokens: 0,
        softLimit: effectiveSoftTokenLimit,
      };
    }

    if (serverContextWindowUsage) {
      const serverTotalTokens = Number(serverContextWindowUsage.total_tokens || 0);
      const serverInputTokens = Number(serverContextWindowUsage.input_tokens || 0);

      return {
        currentTokens: serverTotalTokens || serverInputTokens,
        softLimit: effectiveSoftTokenLimit,
      };
    }

    const validMessages = allMessages.filter(
      (message) => message && typeof message === 'object' && message.role && typeof message.content === 'string'
    );

    for (let i = validMessages.length - 1; i >= 0; i -= 1) {
      const message = validMessages[i];
      if (message.role !== 'assistant' || !message.usage || typeof message.usage !== 'object') {
        continue;
      }

      // The raw usage.total_tokens field (same name for every model) is the
      // actual context consumed by the last request.
      const usageTotalTokens = Number(message.usage.total_tokens || 0);
      const usageInputTokens = Number(message.usage.prompt_tokens || 0);
      return {
        currentTokens: usageTotalTokens || usageInputTokens,
        softLimit: effectiveSoftTokenLimit,
      };
    }

    return {
      currentTokens: 0,
      softLimit: effectiveSoftTokenLimit,
    };
  };

  const contextWindowUsage = getContextWindowUsage(messages);
  const contextUsageRatio = Math.min(1, contextWindowUsage.currentTokens / Math.max(1, contextWindowUsage.softLimit));
  const contextUsagePercent = Math.round(contextUsageRatio * 100);
  const pieRadius = 7;
  const pieCircumference = 2 * Math.PI * pieRadius;
  const pieStrokeOffset = pieCircumference * (1 - contextUsageRatio);

  return {
    contextWindowUsage,
    contextUsageRatio,
    contextUsagePercent,
    pieRadius,
    pieCircumference,
    pieStrokeOffset,
  };
}
