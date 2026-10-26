"""Short-lived caching for anonymous, token-free public API responses.

The public browse endpoints are plain ``def`` handlers, so they run in
FastAPI's threadpool and cannot await the shared async Redis client.  This
module therefore keeps a small *synchronous* client with the same aggressive
timeouts and circuit-breaker behaviour as ``utils.redis_client``: when Redis is
unreachable the endpoints simply build their response from the database.

Only responses that do not depend on the viewer may be cached.  Callers must
skip the cache whenever a session token is present.
"""
import logging
import os
import threading
import time
from typing import Optional

import redis

logger = logging.getLogger(__name__)

PUBLIC_CACHE_TTL_SECONDS = 45
PUBLIC_CACHE_HEADERS = {
    "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
}

_COOLDOWN_SECONDS = 5.0
_client: Optional[redis.Redis] = None
_down_until = 0.0
_lock = threading.Lock()


def _build_redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://localhost:6379/0")


def get_sync_redis() -> Optional[redis.Redis]:
    """Return the shared sync Redis client, or None while Redis is unavailable."""
    global _client, _down_until

    if os.getenv("PUBLIC_CACHE_DISABLED") == "1":
        return None

    if time.monotonic() < _down_until:
        return None

    if _client is not None:
        return _client

    with _lock:
        if _client is not None:
            return _client
        try:
            client = redis.Redis.from_url(
                _build_redis_url(),
                decode_responses=True,
                socket_connect_timeout=0.2,
                socket_timeout=0.2,
                retry_on_timeout=False,
            )
            client.ping()
            _client = client
            return _client
        except Exception:
            _down_until = time.monotonic() + _COOLDOWN_SECONDS
            logger.warning("Public cache Redis unavailable; serving uncached responses")
            return None


def _mark_down() -> None:
    global _client, _down_until
    _client = None
    _down_until = time.monotonic() + _COOLDOWN_SECONDS


def get_cached_text(key: str) -> Optional[str]:
    client = get_sync_redis()
    if client is None:
        return None
    try:
        return client.get(key)
    except Exception:
        _mark_down()
        return None


def set_cached_text(key: str, value: str, ttl: int = PUBLIC_CACHE_TTL_SECONDS) -> None:
    client = get_sync_redis()
    if client is None:
        return
    try:
        client.set(key, value, ex=ttl)
    except Exception:
        _mark_down()


def delete_cached_keys(*keys: str) -> None:
    client = get_sync_redis()
    if client is None or not keys:
        return
    try:
        client.delete(*keys)
    except Exception:
        _mark_down()
