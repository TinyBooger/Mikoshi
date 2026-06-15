"""
Redis client singleton for the Mikoshi backend.
Provides a lazily-initialized async Redis connection.
"""
import os
import logging
import redis.asyncio as aioredis
from typing import Optional

logger = logging.getLogger(__name__)

_redis: Optional[aioredis.Redis] = None


def _build_redis_url() -> str:
    """Build Redis URL from environment or use default."""
    return os.getenv("REDIS_URL", "redis://localhost:6379/0")


async def get_redis() -> aioredis.Redis:
    """Return the shared async Redis client, creating it on first call."""
    global _redis
    if _redis is not None:
        try:
            await _redis.ping()
            return _redis
        except Exception:
            logger.warning("Redis ping failed, reconnecting...")
            _redis = None

    url = _build_redis_url()
    logger.info("Connecting to Redis at %s", url)
    _redis = aioredis.from_url(
        url,
        encoding="utf-8",
        decode_responses=True,
        socket_connect_timeout=3,
        socket_keepalive=True,
        health_check_interval=30,
    )
    await _redis.ping()
    logger.info("Redis connection established")
    return _redis


async def close_redis() -> None:
    """Close the Redis connection gracefully."""
    global _redis
    if _redis is not None:
        await _redis.close()
        _redis = None
        logger.info("Redis connection closed")
