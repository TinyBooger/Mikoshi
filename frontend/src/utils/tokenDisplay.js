const trimTrailingZeros = (value, maxFractionDigits) => {
  const formatted = Number(value).toFixed(maxFractionDigits);
  return formatted.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
};

export const formatCompactTokenCount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';

  const sign = numeric < 0 ? '-' : '';
  const abs = Math.abs(numeric);

  if (abs >= 1_000_000) {
    const digits = abs >= 10_000_000 ? 0 : 1;
    return `${sign}${trimTrailingZeros(abs / 1_000_000, digits)}M`;
  }

  if (abs >= 10_000) {
    const digits = abs >= 100_000 ? 0 : 1;
    return `${sign}${trimTrailingZeros(abs / 10_000, digits)}w`;
  }

  if (abs >= 1_000) {
    const digits = abs >= 10_000 ? 0 : 1;
    return `${sign}${trimTrailingZeros(abs / 1_000, digits)}k`;
  }

  return `${sign}${abs}`;
};

export const getTokenQuotaLabel = (scope) => (
  scope === 'monthly' ? '本月token额度' : '本日token额度'
);
