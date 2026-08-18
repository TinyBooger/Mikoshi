"""
Centralized model configuration registry.

All model metadata — pricing, context windows, rate limits, thinking support —
is defined here so that routes and utilities can derive allowed-model sets,
cost estimates, and capability checks from a single source.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional

# ---------------------------------------------------------------------------
# Peak / idle billing windows (Beijing time, UTC+8)
# ---------------------------------------------------------------------------

BEIJING_TZ = timezone(timedelta(hours=8))

# Peak hours: 9:00-12:00 and 14:00-18:00 Beijing time. All other hours are idle.
_PEAK_WINDOWS = ((9, 12), (14, 18))


def is_peak_time(dt: Optional[datetime] = None) -> bool:
    """Return ``True`` when *dt* falls within the peak billing windows.

    *dt* defaults to the current time. Naive datetimes are assumed to already
    be Beijing time; aware datetimes are converted to Beijing time.
    """
    if dt is None:
        dt = datetime.now(BEIJING_TZ)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=BEIJING_TZ)
    else:
        dt = dt.astimezone(BEIJING_TZ)
    hour = dt.hour
    return any(start <= hour < end for start, end in _PEAK_WINDOWS)


# ---------------------------------------------------------------------------
# Per-model pricing tier (used when cost varies by input token count)
# ---------------------------------------------------------------------------

class PricingTier:
    """A single pricing band keyed by input-token range [min_tokens, max_tokens).

    ``*_per_million`` fields are idle-time prices. Peak-time prices default to
    the idle values when the ``peak_*`` arguments are omitted.
    """
    def __init__(
        self,
        input_per_million: float,
        output_per_million: float,
        min_tokens: int = 0,
        max_tokens: Optional[int] = None,
        peak_input_per_million: Optional[float] = None,
        peak_output_per_million: Optional[float] = None,
    ):
        self.input_per_million = input_per_million
        self.output_per_million = output_per_million
        self.peak_input_per_million = (
            peak_input_per_million if peak_input_per_million is not None else input_per_million
        )
        self.peak_output_per_million = (
            peak_output_per_million if peak_output_per_million is not None else output_per_million
        )
        self.min_tokens = min_tokens
        self.max_tokens = max_tokens

    def __repr__(self):
        return (
            f"PricingTier(input={self.input_per_million}, "
            f"output={self.output_per_million}, "
            f"peak_input={self.peak_input_per_million}, "
            f"peak_output={self.peak_output_per_million}, "
            f"range=[{self.min_tokens}, {self.max_tokens}])"
        )


# ---------------------------------------------------------------------------
# Model configuration
# ---------------------------------------------------------------------------

class ModelConfig:
    """Immutable-ish descriptor for a single model."""

    def __init__(
        self,
        id: str,
        *,
        display_name: str = "",
        # Pricing
        pricing_tiers: List[PricingTier],
        cache_hit_price_per_million: Optional[float] = None,
        peak_cache_hit_price_per_million: Optional[float] = None,
        # Limits
        context_length: int,
        max_output_tokens: int,
        max_input_tokens: Optional[int] = None,
        # Capabilities
        thinking: bool = False,
        # Rate limits (RPM / TPM; None = not rate-limited by that dimension)
        rpm: Optional[int] = None,
        tpm: Optional[int] = None,
        max_concurrent: Optional[int] = None,
        # Cost multiplier (relative to deepseek-v4-flash = 1x)
        multiplier: float = 1.0,
    ):
        self.id = id
        self.display_name = display_name or id
        self.pricing_tiers = pricing_tiers
        self.cache_hit_price_per_million = cache_hit_price_per_million
        self.peak_cache_hit_price_per_million = peak_cache_hit_price_per_million
        self.context_length = context_length
        self.max_output_tokens = max_output_tokens
        self.max_input_tokens = max_input_tokens
        self.thinking = thinking
        self.rpm = rpm
        self.tpm = tpm
        self.max_concurrent = max_concurrent
        self.multiplier = multiplier

    # -- convenience accessors -------------------------------------------------

    @property
    def input_price_per_million(self) -> float:
        """Default (first-tier) input price — useful for single-tier models."""
        return self.pricing_tiers[0].input_per_million if self.pricing_tiers else 0.0

    @property
    def output_price_per_million(self) -> float:
        """Default (first-tier) output price — useful for single-tier models."""
        return self.pricing_tiers[0].output_per_million if self.pricing_tiers else 0.0

    def get_pricing_tier(self, input_tokens: int) -> PricingTier:
        """Return the pricing tier that covers *input_tokens*."""
        for tier in self.pricing_tiers:
            if input_tokens >= tier.min_tokens and (
                tier.max_tokens is None or input_tokens < tier.max_tokens
            ):
                return tier
        # Fallback to last tier
        return self.pricing_tiers[-1]

    def cache_hit_price(self, *, peak: bool = False) -> Optional[float]:
        """Return the cache-hit price for the idle/peak period (or ``None``)."""
        if self.cache_hit_price_per_million is None:
            return None
        if peak and self.peak_cache_hit_price_per_million is not None:
            return self.peak_cache_hit_price_per_million
        return self.cache_hit_price_per_million

    def tokens_to_credits(
        self,
        input_tokens: int,
        output_tokens: int,
        *,
        cached_tokens: int = 0,
        now: Optional[datetime] = None,
    ) -> float:
        """
        Convert token usage to credits (点数).

        1 credit = ¥0.001 CNY.  Cost(¥) = (tokens / 1M) × price_per_million.
        So credits = cost_¥ × 1000 = (input × input_price + output × output_price) / 1000.

        Prices are resolved for the current billing period: peak vs idle windows
        in Beijing time (see ``is_peak_time``). When *cached_tokens* > 0 and the
        model has cache-hit pricing, those tokens are billed at the lower
        cache-hit rate while the remaining prompt tokens use the normal input price.

        Returns 0.0 when pricing data is unavailable.
        """
        if not self.pricing_tiers:
            return 0.0

        peak = is_peak_time(now)
        tier = self.get_pricing_tier(input_tokens)
        input_price = tier.peak_input_per_million if peak else tier.input_per_million
        output_price = tier.peak_output_per_million if peak else tier.output_per_million
        cache_hit_price = self.cache_hit_price(peak=peak)

        if cached_tokens > 0 and cache_hit_price is not None:
            cached_input = min(cached_tokens, input_tokens)
            uncached_input = input_tokens - cached_input
            credit_input = (
                (cached_input / 1_000_000) * cache_hit_price
                + (uncached_input / 1_000_000) * input_price
            )
        else:
            credit_input = (input_tokens / 1_000_000) * input_price

        credit_output = (output_tokens / 1_000_000) * output_price
        # 1 credit = ¥0.001 → multiply cost by 1000
        return round((credit_input + credit_output) * 1000, 4)

    def __repr__(self):
        return f"ModelConfig(id={self.id!r})"


# ===========================================================================
# Registry
# ===========================================================================

MODELS: List[ModelConfig] = [
    # ------------------------------------------------------------------
    # DeepSeek
    # ------------------------------------------------------------------
    ModelConfig(
        id="deepseek-v4-flash",
        display_name="DeepSeek V4 Flash",
        pricing_tiers=[
            PricingTier(
                input_per_million=1.5,
                output_per_million=4.5,
                peak_input_per_million=3.0,
                peak_output_per_million=9.0,
            ),
        ],
        cache_hit_price_per_million=0.05,
        peak_cache_hit_price_per_million=0.10,
        context_length=1_000_000,
        max_output_tokens=384_000,
        thinking=True,
        max_concurrent=2500,
        multiplier=1.0,
    ),
    ModelConfig(
        id="deepseek-v4-pro",
        display_name="DeepSeek V4 Pro",
        pricing_tiers=[
            PricingTier(
                input_per_million=4.5,
                output_per_million=13.5,
                peak_input_per_million=9.0,
                peak_output_per_million=27.0,
            ),
        ],
        cache_hit_price_per_million=0.15,
        peak_cache_hit_price_per_million=0.30,
        context_length=1_000_000,
        max_output_tokens=384_000,
        thinking=True,
        max_concurrent=500,
        multiplier=3.0,
    ),

    # ------------------------------------------------------------------
    # Qwen
    # ------------------------------------------------------------------
    ModelConfig(
        id="qwen3.7-plus",
        display_name="Qwen 3.7 Plus",
        pricing_tiers=[
            PricingTier(input_per_million=2.0, output_per_million=8.0),
        ],
        cache_hit_price_per_million=0.4,
        context_length=1_000_000,
        max_output_tokens=64_000,
        max_input_tokens=1_000_000,
        thinking=True,
        rpm=30_000,
        tpm=10_000_000,
        multiplier=1.3,
    ),
    ModelConfig(
        id="qwen3.6-flash",
        display_name="Qwen 3.6 Flash",
        pricing_tiers=[
            PricingTier(input_per_million=1.2, output_per_million=7.2),
        ],
        cache_hit_price_per_million=0.6,
        context_length=1_000_000,
        max_output_tokens=64_000,
        max_input_tokens=1_000_000,
        thinking=True,
        rpm=30_000,
        tpm=10_000_000,
        multiplier=0.8,
    ),
    ModelConfig(
        id="qwen-plus-character",
        display_name="Qwen Plus Character",
        pricing_tiers=[
            PricingTier(
                input_per_million=0.8,
                output_per_million=2.0,
                max_tokens=32_000,
            ),
        ],
        cache_hit_price_per_million=0.16,
        context_length=32_000,
        max_output_tokens=4_000,
        max_input_tokens=32_000,
        thinking=False,
        rpm=120,
        tpm=500_000,
        multiplier=0.5,
    ),
    ModelConfig(
        id="qwen-flash-character",
        display_name="Qwen Flash Character",
        pricing_tiers=[
            PricingTier(
                input_per_million=0.25,
                output_per_million=1.5,
                max_tokens=8_000,
            ),
        ],
        cache_hit_price_per_million=0.05,
        context_length=8_000,
        max_output_tokens=4_000,
        max_input_tokens=8_000,
        thinking=False,
        rpm=120,
        tpm=500_000,
        multiplier=0.2,
    ),

]

# -- derived lookups ----------------------------------------------------------

_MODEL_BY_ID: Dict[str, ModelConfig] = {m.id: m for m in MODELS}

ALLOWED_MODEL_IDS: set[str] = set(_MODEL_BY_ID.keys())


def get_model(model_id: str) -> Optional[ModelConfig]:
    """Look up a ModelConfig by its id string.  Returns ``None`` when unknown."""
    return _MODEL_BY_ID.get(model_id)


def is_allowed_model(model_id: str) -> bool:
    """``True`` when *model_id* is a known model in the registry."""
    return model_id in _MODEL_BY_ID


def get_allowed_model_ids() -> set[str]:
    """Return the set of all known model ids (convenience for validation)."""
    return ALLOWED_MODEL_IDS.copy()
