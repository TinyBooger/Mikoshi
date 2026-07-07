const IMAGE_MODERATION_REJECTED_PATTERN = /image rejected by content moderation/i;
const TEXT_MODERATION_REJECTED_PATTERN = /text rejected by content moderation/i;
const MODERATION_REJECTED_PATTERN = /rejected by content moderation/i;

export function getApiErrorMessage(data, fallbackMessage, t) {
  const rawMessage = String(data?.message || data?.detail || "").trim();

  if (TEXT_MODERATION_REJECTED_PATTERN.test(rawMessage)) {
    const labelMatch = rawMessage.match(/\((\w+):\s*(\w+)\)/);
    const sublabelMatch = rawMessage.match(/\[SUBLABEL:(.*?)\]/);
    const keywordsMatch = rawMessage.match(/\[KEYWORDS:(.*?)\]/);

    const label = labelMatch ? labelMatch[2] : "";
    const subLabel = sublabelMatch ? sublabelMatch[1].trim() : "";
    const keywords = keywordsMatch ? keywordsMatch[1].trim() : "";

    const detailParts = [];
    if (label) detailParts.push(`违规类型: ${label}`);
    if (subLabel) detailParts.push(`违规子类: ${subLabel}`);
    if (keywords) detailParts.push(`命中关键词: ${keywords}`);

    const detailStr = detailParts.length > 0 ? `\n${detailParts.join("\n")}` : "";
    return `审核未通过，请修改后重试。${detailStr}`;
  }

  if (IMAGE_MODERATION_REJECTED_PATTERN.test(rawMessage)) {
    const labelMatch = rawMessage.match(/\((\w+):\s*(\w+)\)/);
    const sublabelMatch = rawMessage.match(/\[SUBLABEL:(.*?)\]/);

    const label = labelMatch ? labelMatch[2] : "";
    const subLabel = sublabelMatch ? sublabelMatch[1].trim() : "";

    const detailParts = [];
    if (label) detailParts.push(`违规类型: ${label}`);
    if (subLabel) detailParts.push(`违规子类: ${subLabel}`);

    const detailStr = detailParts.length > 0 ? `\n${detailParts.join("\n")}` : "";
    return `图片审核未通过，请更换图片后重试。${detailStr}`;
  }

  // Backward-compatible fallback for older moderation error strings.
  if (MODERATION_REJECTED_PATTERN.test(rawMessage)) {
    return "内容审核未通过，请修改后重试。";
  }

  return rawMessage || fallbackMessage;
}