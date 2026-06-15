"""
Model API rate limiter with Redis-backed sliding windows and concurrency pools.

Provides:
  1. Per-user rate limiting (requests per minute / per hour) with separate
     limits for free and pro users.
  2. Concurrency control via named pools — pro users get a larger dedicated
     pool so their requests are prioritised when the server is under load.
"""
from __future__ import annotations

import asyncio
import time
import logging
from typing import Optional

from utils.redis_client import get_redis

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Hard‑coded defaults
# ---------------------------------------------------------------------------

_FREE_RPM = 20        # requests per minute  (free)
_FREE_RPH = 200       # requests per hour    (free)
_PRO_RPM = 60         # requests per minute  (pro)
_PRO_RPH = 600        # requests per hour    (pro)

_FREE_CONCURRENCY = 2
_PRO_CONCURRENCY = 5

_WINDOW_GRACE_S = 5   # small grace period so clock skew doesn't reject early
_POLL_INTERVAL_S = 0.25  # fixed interval for concurrency pool polling

# ---------------------------------------------------------------------------
# Lua scripts (loaded once per process, executed via EVALSHA)
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
    -- find when the oldest request expires
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local reset_time = now
    if #oldest >= 2 then
        reset_time = tonumber(oldest[2]) + window
    end
    return {0, 0, reset_time}
end

-- math.random() ensures uniqueness without a separate :seq key that lacks a TTL
local member = now .. ':' .. math.random(1000000, 9999999)
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttl)
local remaining = limit - (count + 1)
return {1, remaining, now + window}
"""

# Atomic concurrency slot acquire — uses INCR-then-check to avoid the
# read ⇒ check ⇒ incr race.  If INCR overshoots the limit we DECR to undo.
# KEYS[1] = counter key   e.g.  concurrency:pro
# ARGV[1] = max slots
# ARGV[2] = TTL (seconds) — safety net so crashed workers don't leak slots forever
# Returns: 1 if acquired, 0 if pool full
_ACQUIRE_SLOT_LUA = """
local key   = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl   = tonumber(ARGV[2])

local new_val = redis.call('INCR', key)
redis.call('EXPIRE', key, ttl)
if new_val > limit then
    redis.call('DECR', key)
    return 0
end
return 1
"""

# Release a concurrency slot (decrements, floor 0).
_RELEASE_SLOT_LUA = """
local key = KEYS[1]
local current = tonumber(redis.call('GET', key) or '0')
if current > 0 then
    redis.call('DECR', key)
end
return 1
"""

# ---------------------------------------------------------------------------
# Module‑level script cache (shared by all instances)
# ---------------------------------------------------------------------------

_scripts_loaded = False
_sha_sliding: str = ""
_sha_acquire: str = ""
_sha_release: str = ""


async def _ensure_scripts() -> None:
    """Load Lua scripts into Redis once per process."""
    global _scripts_loaded, _sha_sliding, _sha_acquire, _sha_release
    if _scripts_loaded:
        return
    redis = await get_redis()
    _sha_sliding = await redis.script_load(_SLIDING_WINDOW_LUA)
    _sha_acquire = await redis.script_load(_ACQUIRE_SLOT_LUA)
    _sha_release = await redis.script_load(_RELEASE_SLOT_LUA)
    _scripts_loaded = True


# ===================================================================
# ModelRateLimiter
# ===================================================================


class ModelRateLimiter:
    """Per‑user rate limiter for the /api/chat endpoint."""

    async def check_rate_limit(
        self,
        user_id: str,
        is_pro: bool,
    ) -> dict:
        """
        Check and record a rate‑limit hit for *user_id*.

        Hour window is checked **read‑only first** so that a request
        rejected because the hour is exhausted does not burn a
        minute‑window slot (no double‑counting).

        Returns
        -------
        dict
            allowed       : bool
            remaining     : int  (requests left in the current minute window)
            limit         : int  (rpm cap for this tier)
            reset_seconds : int  (seconds until the window resets, approx.)

        If Redis is unreachable the request is **allowed** (fail‑open).
        """
        rpm = _PRO_RPM if is_pro else _FREE_RPM
        rph = _PRO_RPH if is_pro else _FREE_RPH

        try:
            await _ensure_scripts()
            redis = await get_redis()
            now = time.time()

            minute_key = f"rate_limit:{user_id}:minute"
            hour_key = f"rate_limit:{user_id}:hour"

            # ── hour window: peek first (read‑only, no side‑effects) ──
            count_hr = await redis.zcount(
                hour_key,
                int(now) - (3600 + _WINDOW_GRACE_S),
                "+inf",
            )
            if count_hr >= rph:
                oldest = await redis.zrange(hour_key, 0, 0, withscores=True)
                reset_hr = now + 3600
                for _member, score in (oldest or []):
                    reset_hr = float(score) + 3600
                return {
                    "allowed": False,
                    "remaining": 0,
                    "limit": rpm,
                    "limit_hour": rph,
                    "remaining_hour": 0,
                    "reset_seconds": max(0, int(reset_hr - now)),
                    "tier": "pro" if is_pro else "free",
                }

            # ── minute window: atomic check‑and‑add ──
            result_min = await redis.evalsha(
                _sha_sliding,
                1,
                minute_key,
                60 + _WINDOW_GRACE_S,
                rpm,
                int(now),
                120,
            )
            allowed_min, remaining_min, reset_min = (
                bool(result_min[0]),
                int(result_min[1]),
                int(result_min[2]),
            )

            if not allowed_min:
                return {
                    "allowed": False,
                    "remaining": 0,
                    "limit": rpm,
                    "limit_hour": rph,
                    "remaining_hour": max(0, rph - count_hr),
                    "reset_seconds": max(0, int(reset_min - now)),
                    "tier": "pro" if is_pro else "free",
                }

            # ── hour window: now record the hit ──
            result_hr = await redis.evalsha(
                _sha_sliding,
                1,
                hour_key,
                3600 + _WINDOW_GRACE_S,
                rph,
                int(now),
                7200,
            )

            return {
                "allowed": True,
                "remaining": remaining_min,
                "limit": rpm,
                "limit_hour": rph,
                "remaining_hour": max(0, rph - (count_hr + 1)),
                "reset_seconds": max(0, int(min(reset_min, now + 60) - now)),
                "tier": "pro" if is_pro else "free",
            }

        except Exception:
            logger.exception("Redis error during rate‑limit check — failing open")
            return {
                "allowed": True,
                "remaining": rpm,
                "limit": rpm,
                "limit_hour": rph,
                "remaining_hour": rph,
                "reset_seconds": 0,
                "tier": "pro" if is_pro else "free",
            }

    async def get_rate_limit_status(
        self,
        user_id: str,
        is_pro: bool,
    ) -> dict:
        """Return current rate‑limit status without consuming a request.

        Fails open (returns full allowance) if Redis is unreachable."""
        rpm = _PRO_RPM if is_pro else _FREE_RPM
        rph = _PRO_RPH if is_pro else _FREE_RPH

        try:
            await _ensure_scripts()
            redis = await get_redis()
            now = time.time()

            minute_key = f"rate_limit:{user_id}:minute"
            hour_key = f"rate_limit:{user_id}:hour"

            # count only, don't add
            count_min = await redis.zcount(minute_key, now - (60 + _WINDOW_GRACE_S), "+inf")
            count_hr = await redis.zcount(hour_key, now - (3600 + _WINDOW_GRACE_S), "+inf")

            remaining_min = max(0, rpm - count_min)
            remaining_hr = max(0, rph - count_hr)

            return {
                "tier": "pro" if is_pro else "free",
                "limit_minute": rpm,
                "remaining_minute": remaining_min,
                "limit_hour": rph,
                "remaining_hour": remaining_hr,
            }
        except Exception:
            logger.exception("Redis error during rate‑limit status check — failing open")
            return {
                "tier": "pro" if is_pro else "free",
                "limit_minute": rpm,
                "remaining_minute": rpm,
                "limit_hour": rph,
                "remaining_hour": rph,
            }


# ===================================================================
# ConcurrencyPool
# ===================================================================


class ConcurrencyPool:
    """Named concurrency pools backed by Redis atomic counters."""

    @staticmethod
    def _pool_key(is_pro: bool) -> str:
        return "concurrency:pro" if is_pro else "concurrency:free"

    @staticmethod
    def _pool_limit(is_pro: bool) -> int:
        return _PRO_CONCURRENCY if is_pro else _FREE_CONCURRENCY

    async def acquire(self, is_pro: bool, timeout_s: float = 30.0) -> bool:
        """
        Try to acquire a concurrency slot for the given tier.

        Blocks (polls) for up to *timeout_s* seconds if no slot is
        immediately available.  Returns ``True`` on success.

        Fails open (returns ``True``) if Redis is unreachable.
        """
        try:
            await _ensure_scripts()
            redis = await get_redis()
        except Exception:
            logger.exception("Redis error during concurrency acquire — failing open")
            return True

        key = self._pool_key(is_pro)
        limit = self._pool_limit(is_pro)
        # TTL = max expected completion time × 2, as safety net
        ttl = 300

        deadline = time.monotonic() + timeout_s
        while True:
            try:
                acquired = await redis.evalsha(
                    _sha_acquire,
                    1,
                    key,
                    limit,
                    ttl,
                )
            except Exception:
                logger.exception("Redis error during concurrency acquire poll — failing open")
                return True

            if acquired == 1:
                return True

            if time.monotonic() >= deadline:
                logger.warning(
                    "Concurrency pool %s full (limit=%d), user timed out",
                    key, limit,
                )
                return False

            await asyncio.sleep(_POLL_INTERVAL_S)

    async def release(self, is_pro: bool) -> None:
        """Release a previously acquired slot."""
        try:
            redis = await get_redis()
            await redis.evalsha(_sha_release, 1, self._pool_key(is_pro))
        except Exception:
            logger.exception("Failed to release concurrency slot")


# ---------------------------------------------------------------------------
# Module‑level singletons — import these where needed
# ---------------------------------------------------------------------------

rate_limiter = ModelRateLimiter()
concurrency_pool = ConcurrencyPool()
