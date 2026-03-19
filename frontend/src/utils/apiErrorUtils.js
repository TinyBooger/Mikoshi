const MODERATION_REJECTED_PATTERN = /rejected by content moderation/i;

export function getApiErrorMessage(data, fallbackMessage, t) {
  const rawMessage = String(data?.message || data?.detail || "").trim();

  if (MODERATION_REJECTED_PATTERN.test(rawMessage)) {
    if (typeof t === "function") {
      return t(
        "common.image_moderation_rejected",
        "图片审核未通过，请更换图片后重试。"
      );
    }
    return "图片审核未通过，请更换图片后重试。";
  }

  return rawMessage || fallbackMessage;
}