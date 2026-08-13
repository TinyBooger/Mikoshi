"""
Redis client singleton for the Mikoshi backend.
Provides a lazily-initialized async Redis connection.
"""
import os
import logging
import time
import redis.asyncio as aioredis
from typing import Optional

logger = logging.getLogger(__name__)

_redis: Optional[aioredis.Redis] = None
_blocking_redis: Optional[aioredis.Redis] = None

# Circuit breaker: when Redis is unreachable, skip connection attempts
# for this many seconds to avoid paying the socket-connect timeout on
# every single chat request.
_REDIS_COOLDOWN_S = 5
_redis_down_until: float = 0


class RedisUnavailable(Exception):
    """Raised when Redis is known to be down (circuit breaker open)."""


def _build_redis_url() -> str:
    """Build Redis URL from environment or use default."""
    return os.getenv("REDIS_URL", "redis://localhost:6379/0")


async def get_redis() -> aioredis.Redis:
    """Return the shared async Redis client, creating it on first call.

    Uses aggressive connect / socket timeouts so that an unreachable
    Redis does not stall every chat request for multiple seconds.
    A short-lived circuit breaker (*_redis_down_until*) prevents
    retrying the full connect on every request while Redis is down.
    """
    global _redis, _redis_down_until

    # ── circuit breaker: skip the connect attempt entirely ──
    now = time.monotonic()
    if now < _redis_down_until:
        raise RedisUnavailable("Redis circuit breaker open — skipping connect")

    if _redis is not None:
        try:
            await _redis.ping()
            return _redis
        except Exception:
            logger.warning("Redis ping failed, reconnecting...")
            _redis = None

    url = _build_redis_url()
    logger.info("Connecting to Redis at %s", url)
    try:
        _redis = aioredis.from_url(
            url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
            retry_on_timeout=False,
            socket_keepalive=True,
            health_check_interval=30,
        )
        await _redis.ping()
        _redis_down_until = 0  # reset circuit breaker on success
        logger.info("Redis connection established")
        return _redis
    except Exception:
        _redis = None
        _redis_down_until = time.monotonic() + _REDIS_COOLDOWN_S
        logger.warning(
            "Redis unavailable — circuit breaker open for %ss",
            _REDIS_COOLDOWN_S,
        )
        raise RedisUnavailable("Redis connection failed")


async def get_blocking_redis() -> aioredis.Redis:
    """Return a dedicated async Redis client for blocking commands.

    Blocking commands (``XREADGROUP ... BLOCK``, ``BLPOP``, etc.) hold the
    connection open for their full block/timeout duration.  The shared
    client's aggressive ``socket_timeout=0.2`` would abort those socket
    reads early with a spurious ``TimeoutError`` on every idle poll, so
    this client disables the socket read timeout (``socket_timeout=None``)
    and lets Redis itself enforce the command-level block timeout.

    Kept separate from the shared client so the short, fast-fail timeout
    used by ordinary chat traffic is not loosened globally.
    """
    global _blocking_redis

    if _blocking_redis is not None:
        try:
            await _blocking_redis.ping()
            return _blocking_redis
        except Exception:
            logger.warning("Blocking Redis ping failed, reconnecting...")
            _blocking_redis = None

    url = _build_redis_url()
    logger.info("Connecting to Redis (blocking) at %s", url)
    _blocking_redis = aioredis.from_url(
        url,
        encoding="utf-8",
        decode_responses=True,
        socket_connect_timeout=2.0,
        socket_timeout=None,  # blocking commands enforce their own timeout
        retry_on_timeout=False,
        socket_keepalive=True,
        health_check_interval=30,
    )
    await _blocking_redis.ping()
    logger.info("Blocking Redis connection established")
    return _blocking_redis


async def close_redis() -> None:
    """Close the Redis connections gracefully."""
    global _redis, _blocking_redis
    if _redis is not None:
        await _redis.close()
        _redis = None
        logger.info("Redis connection closed")
    if _blocking_redis is not None:
        await _blocking_redis.close()
        _blocking_redis = None
        logger.info("Blocking Redis connection closed")
