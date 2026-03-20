const IMAGE_MODERATION_REJECTED_PATTERN = /^image rejected by content moderation/i;
const TEXT_MODERATION_REJECTED_PATTERN = /^text rejected by content moderation/i;
const MODERATION_REJECTED_PATTERN = /rejected by content moderation/i;

export function getApiErrorMessage(data, fallbackMessage, t) {
  const rawMessage = String(data?.message || data?.detail || "").trim();

  if (TEXT_MODERATION_REJECTED_PATTERN.test(rawMessage)) {
    if (typeof t === "function") {
      return t(
        "common.text_moderation_rejected",
        "文字审核未通过，请修改后重试。"
      );
    }
    return "文字审核未通过，请修改后重试。";
  }

  if (IMAGE_MODERATION_REJECTED_PATTERN.test(rawMessage)) {
    if (typeof t === "function") {
      return t(
        "common.image_moderation_rejected",
        "图片审核未通过，请更换图片后重试。"
      );
    }
    return "图片审核未通过，请更换图片后重试。";
  }

  // Backward-compatible fallback for older moderation error strings.
  if (MODERATION_REJECTED_PATTERN.test(rawMessage)) {
    return "内容审核未通过，请修改后重试。";
  }

  return rawMessage || fallbackMessage;
}