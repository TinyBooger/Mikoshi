"""
Per-user rate limiter with a Redis-backed sliding window (per minute).

Separate limits for free and pro users.  No provider / model awareness —
this only cares about "how many requests has this user made in the
current minute window".
"""
from __future__ import annotations

import time
import logging

from utils.redis_client import get_redis

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Hard‑coded defaults
# ---------------------------------------------------------------------------

_FREE_RPM = 20        # requests per minute  (free)
_PRO_RPM = 60         # requests per minute  (pro)

_WINDOW_GRACE_S = 5   # small grace period so clock skew doesn't reject early

# ---------------------------------------------------------------------------
# Lua script (loaded once per process)
# ---------------------------------------------------------------------------

# Atomic sliding‑window check + add.
# KEYS[1] = sorted‑set key          e.g.  rate_limit:user123:minute
# ARGV[1] = window size in seconds  e.g.  60
# ARGV[2] = max requests in window  e.g.  20
# ARGV[3] = current timestamp (seconds)
# ARGV[4] = key TTL (seconds)       e.g.  120
# Returns: {allowed (0|1), remaining (int), reset_time (int)}
_SLIDING_WINDOW_LUA = """
local key      = KEYS[1]
local window   = tonumber(ARGV[1])
local limit    = tonumber(ARGV[2])
local now      = tonumber(ARGV[3])
local ttl      = tonumber(ARGV[4])
local cutoff   = now - window

redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
local count = redis.call('ZCARD', key)

if count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local reset_time = now
    if #oldest >= 2 then
        reset_time = tonumber(oldest[2]) + window
    end
    return {0, 0, reset_time}
end

local member = now .. ':' .. math.random(1000000, 9999999)
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttl)
local remaining = limit - (count + 1)
return {1, remaining, now + window}
"""

# ---------------------------------------------------------------------------
# Module‑level script cache
# ---------------------------------------------------------------------------

_scripts_loaded = False
_sha_sliding = ""


async def _ensure_script() -> None:
    global _scripts_loaded, _sha_sliding
    if _scripts_loaded:
        return
    redis = await get_redis()
    _sha_sliding = await redis.script_load(_SLIDING_WINDOW_LUA)
    _scripts_loaded = True


# ===================================================================
# RateLimiter
# ===================================================================


class RateLimiter:
    """Per‑user sliding‑window rate limiter.  Model / provider agnostic."""

    async def check(
        self,
        user_id: str,
        is_pro: bool,
    ) -> dict:
        """
        Check and record a rate‑limit hit for *user_id*.

        Returns
        -------
        dict with keys:
            allowed       : bool
            remaining     : int   (requests left in current minute window)
            limit         : int   (rpm cap for this tier)
            reset_seconds : int   (approx. seconds until window resets)
            tier          : str   ("free" | "pro")

        Fails open when Redis is unreachable.
        """
        rpm = _PRO_RPM if is_pro else _FREE_RPM

        try:
            await _ensure_script()
            redis = await get_redis()
            now = time.time()

            minute_key = f"rate_limit:{user_id}:minute"

            # ── atomic sliding‑window check‑and‑add ──
            result = await redis.evalsha(
                _sha_sliding,
                1,
                minute_key,
                60 + _WINDOW_GRACE_S,
                rpm,
                int(now),
                120,
            )
            allowed, remaining, reset_time = (
                bool(result[0]),
                int(result[1]),
                int(result[2]),
            )

            return {
                "allowed": allowed,
                "remaining": remaining,
                "limit": rpm,
                "reset_seconds": max(0, int(reset_time - now)),
                "tier": "pro" if is_pro else "free",
            }

        except Exception:
            logger.exception("Redis error during rate‑limit check — failing open")
            return {
                "allowed": True,
                "remaining": rpm,
                "limit": rpm,
                "reset_seconds": 0,
                "tier": "pro" if is_pro else "free",
            }

    async def status(
        self,
        user_id: str,
        is_pro: bool,
    ) -> dict:
        """Return current rate‑limit status without consuming a request.
        Fails open when Redis is unreachable."""
        rpm = _PRO_RPM if is_pro else _FREE_RPM

        try:
            await _ensure_script()
            redis = await get_redis()
            now = time.time()

            minute_key = f"rate_limit:{user_id}:minute"
            count_min = await redis.zcount(minute_key, now - (60 + _WINDOW_GRACE_S), "+inf")

            return {
                "tier": "pro" if is_pro else "free",
                "limit_minute": rpm,
                "remaining_minute": max(0, rpm - count_min),
            }
        except Exception:
            logger.exception("Redis error during rate‑limit status check — failing open")
            return {
                "tier": "pro" if is_pro else "free",
                "limit_minute": rpm,
                "remaining_minute": rpm,
            }


# ---------------------------------------------------------------------------
# Module‑level singleton
# ---------------------------------------------------------------------------

rate_limiter = RateLimiter()
