"""
Centralized model configuration registry.

All model metadata — pricing, context windows, rate limits, thinking support —
is defined here so that routes and utilities can derive allowed-model sets,
cost estimates, and capability checks from a single source.
"""

from typing import List, Dict, Optional, Union, Literal

# ---------------------------------------------------------------------------
# Per-model pricing tier (used when cost varies by input token count)
# ---------------------------------------------------------------------------

class PricingTier:
    """A single pricing band keyed by input-token range [min_tokens, max_tokens)."""
    def __init__(
        self,
        input_per_million: float,
        output_per_million: float,
        min_tokens: int = 0,
        max_tokens: Optional[int] = None,
    ):
        self.input_per_million = input_per_million
        self.output_per_million = output_per_million
        self.min_tokens = min_tokens
        self.max_tokens = max_tokens

    def __repr__(self):
        return (
            f"PricingTier(input={self.input_per_million}, "
            f"output={self.output_per_million}, "
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
    ):
        self.id = id
        self.display_name = display_name or id
        self.pricing_tiers = pricing_tiers
        self.cache_hit_price_per_million = cache_hit_price_per_million
        self.context_length = context_length
        self.max_output_tokens = max_output_tokens
        self.max_input_tokens = max_input_tokens
        self.thinking = thinking
        self.rpm = rpm
        self.tpm = tpm
        self.max_concurrent = max_concurrent

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

    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        *,
        cache_hit: bool = False,
    ) -> float:
        """
        Estimate cost in **RMB (元)** for a request.

        Returns 0.0 when pricing data is unavailable.
        """
        if not self.pricing_tiers:
            return 0.0

        # Cache-hit pricing (only for models that support it, e.g. DeepSeek)
        if cache_hit and self.cache_hit_price_per_million is not None:
            input_price = self.cache_hit_price_per_million
        else:
            input_price = self.get_pricing_tier(input_tokens).input_per_million

        output_price = self.get_pricing_tier(input_tokens).output_per_million

        cost_input = (input_tokens / 1_000_000) * input_price
        cost_output = (output_tokens / 1_000_000) * output_price
        return round(cost_input + cost_output, 6)

    def tokens_to_credits(
        self,
        input_tokens: int,
        output_tokens: int,
        *,
        cache_hit: bool = False,
    ) -> float:
        """
        Convert token usage to credits (点数).

        1 credit = ¥0.001 CNY.  Cost(¥) = (tokens / 1M) × price_per_million.
        So credits = cost_¥ × 1000 = (input × input_price + output × output_price) / 1000.

        Returns 0.0 when pricing data is unavailable.
        """
        if not self.pricing_tiers:
            return 0.0

        # Cache-hit pricing (only for models that support it, e.g. DeepSeek)
        if cache_hit and self.cache_hit_price_per_million is not None:
            input_price = self.cache_hit_price_per_million
        else:
            input_price = self.get_pricing_tier(input_tokens).input_per_million

        output_price = self.get_pricing_tier(input_tokens).output_per_million

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
            PricingTier(input_per_million=1.0, output_per_million=2.0),
        ],
        cache_hit_price_per_million=0.02,
        context_length=384_000,
        max_output_tokens=1_000_000,
        thinking=True,
        max_concurrent=500,
    ),
    ModelConfig(
        id="deepseek-v4-pro",
        display_name="DeepSeek V4 Pro",
        pricing_tiers=[
            PricingTier(input_per_million=3.0, output_per_million=6.0),
        ],
        cache_hit_price_per_million=0.025,
        context_length=384_000,
        max_output_tokens=1_000_000,
        thinking=True,
        max_concurrent=1500,
    ),

    # ------------------------------------------------------------------
    # Qwen
    # ------------------------------------------------------------------
    ModelConfig(
        id="qwen3.7-max",
        display_name="Qwen 3.7 Max",
        pricing_tiers=[
            PricingTier(
                input_per_million=12.0,
                output_per_million=36.0,
                max_tokens=1_000_000,
            ),
        ],
        context_length=1_000_000,
        max_output_tokens=64_000,
        max_input_tokens=1_000_000,
        thinking=True,
        rpm=30_000,
        tpm=10_000_000,
    ),
    ModelConfig(
        id="qwen3.7-plus",
        display_name="Qwen 3.7 Plus",
        pricing_tiers=[
            PricingTier(input_per_million=2.0, output_per_million=8.0),
        ],
        context_length=1_000_000,
        max_output_tokens=64_000,
        max_input_tokens=1_000_000,
        thinking=True,
        rpm=30_000,
        tpm=10_000_000,
    ),
    ModelConfig(
        id="qwen3.6-flash",
        display_name="Qwen 3.6 Flash",
        pricing_tiers=[
            PricingTier(input_per_million=1.2, output_per_million=7.2),
        ],
        context_length=1_000_000,
        max_output_tokens=64_000,
        max_input_tokens=1_000_000,
        thinking=True,
        rpm=30_000,
        tpm=10_000_000,
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
        context_length=32_000,
        max_output_tokens=4_000,
        max_input_tokens=32_000,
        thinking=False,
        rpm=120,
        tpm=500_000,
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
        context_length=8_000,
        max_output_tokens=4_000,
        max_input_tokens=8_000,
        thinking=False,
        rpm=120,
        tpm=500_000,
    ),

    # ------------------------------------------------------------------
    # Kimi
    # ------------------------------------------------------------------
    ModelConfig(
        id="kimi-k2.6",
        display_name="Kimi K2.6",
        pricing_tiers=[
            PricingTier(
                input_per_million=6.4,
                output_per_million=27.0,
                max_tokens=224_000,
            ),
        ],
        context_length=256_000,
        max_output_tokens=16_000,
        max_input_tokens=224_000,
        thinking=True,
        rpm=500,
        tpm=1_000_000,
    ),

    # ------------------------------------------------------------------
    # GLM
    # ------------------------------------------------------------------
    ModelConfig(
        id="glm-5.1",
        display_name="GLM 5.1",
        pricing_tiers=[
            PricingTier(input_per_million=6.0, output_per_million=24.0),
        ],
        context_length=200_000,
        max_output_tokens=128_000,
        max_input_tokens=200_000,
        thinking=False,
        rpm=500,
        tpm=20_000_000,
    ),

    # ------------------------------------------------------------------
    # MiniMax
    # ------------------------------------------------------------------
    ModelConfig(
        id="MiniMax-M2.5",
        display_name="MiniMax M2.5",
        pricing_tiers=[
            PricingTier(
                input_per_million=2.1,
                output_per_million=8.4,
                max_tokens=200_000,
            ),
        ],
        context_length=200_000,
        max_output_tokens=128_000,
        max_input_tokens=200_000,
        thinking=True,
        rpm=500,
        tpm=20_000_000,
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
