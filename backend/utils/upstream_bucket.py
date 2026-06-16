"""
Per-model upstream request bucket with Redis Streams.

Provides rate-paced, priority-ordered access to upstream model providers.
Pro users get priority in the queue: two separate streams per model
(pro / free) are drained pro‑first by the dispenser.  Within each tier
ordering is FIFO.

Completely separate from user-facing rate limiting — this only gates
the moment a request actually calls the provider API.

Models without an ``rpm`` in their ModelConfig are never rate-limited
(the bucket passes them through immediately).

Architecture
------------
Each model with an RPM cap gets three Redis keys:

* ``upstream_rate:{model_id}``        — Sorted Set  (sliding window, 60 s)
* ``upstream_bucket:{model_id}:pro``  — Redis Stream (FIFO, pro tier)
* ``upstream_bucket:{model_id}:free`` — Redis Stream (FIFO, free tier)

A Lua script atomically checks the sliding window.  Requests that fall
within the RPM limit are admitted immediately.  Requests that exceed it
are appended to the pro or free stream depending on the user's tier.
A background *dispenser* task (one per model) reads from the two streams
(pro first, then free) at the model's RPM pace and unblocks the waiting
request via a short‑lived Redis list signal.
"""
from __future__ import annotations

import asyncio
import os
import platform
import time
import uuid
import logging
from typing import Dict

from utils.redis_client import get_redis
from model_configs import get_model, MODELS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Redis key helpers
# ---------------------------------------------------------------------------

_STREAM_PREFIX = "upstream_bucket"
_RATE_PREFIX = "upstream_rate"
_SIGNAL_PREFIX = "upstream_signal"

# Per‑instance consumer group so multiple workers don't compete for the same
# pending entries.  hostname + pid is stable within a process lifetime.
_INSTANCE_ID = f"{platform.node()}_{os.getpid()}"
CONSUMER_GROUP = f"upstream_dispenser_{_INSTANCE_ID}"

WINDOW_S = 60
RATE_KEY_TTL = 120       # 2× window — safety net for the sorted set
SIGNAL_TTL = 60          # waiter either picks the signal up or times out

# Stream trimming: keep at most this many entries per stream.
# At 120 RPM × 30 s timeout worst case, ~60 entries could pile up.
# 1000 gives plenty of headroom without unbounded growth.
STREAM_MAXLEN = 1000

# XREADGROUP poll cooldown when a stream has no data (ms).
XREAD_BLOCK_MS = 5000

# How long a message must be idle before XAUTOCLAIM steals it (ms).
AUTOCLAIM_MIN_IDLE_MS = 1000

# ---------------------------------------------------------------------------
# Lua script: atomic check-or-queue
# ---------------------------------------------------------------------------

# KEYS[1] = rate sorted set   (upstream_rate:{model})
# KEYS[2] = stream            (upstream_bucket:{model}:pro  or  :free)
# ARGV[1] = rpm limit
# ARGV[2] = window seconds    (60)
# ARGV[3] = current timestamp (int)
# ARGV[4] = rate-key TTL
# ARGV[5] = unique request id  (ts_hex:uuid_hex — deduplicates across restarts)
#
# Returns:  { status, detail }
#   status = 1  →  detail = remaining (int)
#   status = 0  →  detail = stream message id (str)
_ACQUIRE_LUA = r"""
local rate_key   = KEYS[1]
local stream_key = KEYS[2]
local rpm        = tonumber(ARGV[1])
local window     = tonumber(ARGV[2])
local now        = tonumber(ARGV[3])
local ttl        = tonumber(ARGV[4])
local request_id = ARGV[5]

-- 1. Purge expired entries from the sliding window
redis.call('ZREMRANGEBYSCORE', rate_key, '-inf', now - window)

-- 2. Count current in-window requests
local count = redis.call('ZCARD', rate_key)

-- 3. Under limit → admit immediately
if count < rpm then
    redis.call('ZADD', rate_key, now, request_id)
    redis.call('EXPIRE', rate_key, ttl)
    return {1, rpm - count - 1}
end

-- 4. Over limit → queue in tiered stream (FIFO)
local msg_id = redis.call(
    'XADD', stream_key, '*',
    'request_id', request_id,
    'ts', now
)
return {0, msg_id}
"""

# ---------------------------------------------------------------------------
# Script cache
# ---------------------------------------------------------------------------

_scripts_ready = False
_sha_acquire: str = ""


async def _ensure_script() -> None:
    global _scripts_ready, _sha_acquire
    if _scripts_ready:
        return
    redis = await get_redis()
    _sha_acquire = await redis.script_load(_ACQUIRE_LUA)
    _scripts_ready = True


# ===================================================================
# Public API
# ===================================================================


async def acquire_upstream(
    model_id: str,
    *,
    is_pro: bool = False,
    timeout_s: float = 30.0,
) -> bool:
    """Try to acquire an upstream request slot for *model_id*.

    * If the model has no ``rpm`` configured, always returns ``True``.
    * If the model is under its RPM cap, returns ``True`` immediately.
    * Otherwise the call is queued in the pro or free Redis Stream
      (depending on *is_pro*) and this coroutine blocks until the
      dispenser releases a slot, or *timeout_s* elapses.

    Pro requests are dispatched before free requests by the dispenser.

    Fails **open** — returns ``True`` on any Redis error so that a
    transient infrastructure problem does not block requests.
    """
    model = get_model(model_id)
    if model is None or model.rpm is None:
        return True  # not rate-limited

    rpm: int = model.rpm
    tier = "pro" if is_pro else "free"
    stream_key = f"{_STREAM_PREFIX}:{model_id}:{tier}"
    # Timestamp prefix makes collisions effectively impossible even under
    # pathological clock conditions, and gives us a rough ordering hint.
    request_id = f"{int(time.time()):x}:{uuid.uuid4().hex}"

    try:
        await _ensure_script()
        redis = await get_redis()
        now = time.time()

        result = await redis.evalsha(
            _sha_acquire,
            2,
            f"{_RATE_PREFIX}:{model_id}",
            stream_key,
            rpm,
            WINDOW_S,
            int(now),
            RATE_KEY_TTL,
            request_id,
        )

        status = int(result[0])

        if status == 1:
            return True  # admitted immediately

        # ---- queued — wait for dispenser signal ----
        signal_key = f"{_SIGNAL_PREFIX}:{request_id}"
        popped = await redis.blpop(signal_key, timeout=int(timeout_s))

        if popped is None:
            logger.debug(
                "Upstream bucket wait timed out for model=%s req=%s tier=%s",
                model_id,
                request_id,
                tier,
            )
            return False

        return True

    except Exception:
        logger.exception(
            "Upstream bucket error for model=%s — failing open", model_id
        )
        return True


# ===================================================================
# Dispenser (background task, one per rate-limited model)
# ===================================================================

_dispenser_tasks: Dict[str, asyncio.Task] = {}


def _stream_keys(model_id: str) -> tuple[str, str]:
    """Return (pro_stream_key, free_stream_key) for *model_id*."""
    return (
        f"{_STREAM_PREFIX}:{model_id}:pro",
        f"{_STREAM_PREFIX}:{model_id}:free",
    )


def _model_ids_with_rpm() -> list[str]:
    """Return model ids that have an ``rpm`` defined in the registry."""
    return [m.id for m in MODELS if m.rpm is not None]


async def _run_dispenser(model_id: str, rpm: int) -> None:
    """Read from *model_id*'s two streams (pro first, free second)
    at *rpm* pace and unblock waiters."""
    consumer_id = f"disp-{uuid.uuid4().hex[:8]}"
    interval = 60.0 / rpm  # seconds between dispatches

    logger.info(
        "🔀 Upstream dispenser: model=%s rpm=%d interval=%.4fs",
        model_id,
        rpm,
        interval,
    )

    redis = await get_redis()
    pro_key, free_key = _stream_keys(model_id)
    rate_key = f"{_RATE_PREFIX}:{model_id}"

    # -- Ensure consumer groups exist on both streams (idempotent) --
    for sk in (pro_key, free_key):
        try:
            await redis.xgroup_create(
                sk, CONSUMER_GROUP, id="0", mkstream=True
            )
        except Exception:
            pass  # GROUP already exists

    # -- Reclaim pending from both streams (pro first, at RPM pace) --
    await _claim_pending(redis, pro_key, consumer_id, rate_key, rpm, interval)
    await _claim_pending(redis, free_key, consumer_id, rate_key, rpm, interval)

    last_dispatch = time.monotonic()

    while True:
        try:
            # Read from BOTH streams — pro listed first wins on tie
            streams = await redis.xreadgroup(
                CONSUMER_GROUP,
                consumer_id,
                {pro_key: ">", free_key: ">"},
                count=1,
                block=XREAD_BLOCK_MS,
            )

            if not streams:
                continue

            for stream_name, entries in streams:
                for msg_id, fields in entries:
                    request_id = fields.get("request_id", "")
                    if not request_id:
                        await redis.xack(stream_name, CONSUMER_GROUP, msg_id)
                        continue

                    # ---- pace to RPM ----
                    now_mono = time.monotonic()
                    delay = interval - (now_mono - last_dispatch)
                    if delay > 0:
                        await asyncio.sleep(delay)

                    # ---- consume RPM slot ----
                    await redis.zadd(rate_key, {request_id: time.time()})
                    await redis.expire(rate_key, RATE_KEY_TTL)

                    # ---- unblock waiter ----
                    signal_key = f"{_SIGNAL_PREFIX}:{request_id}"
                    await redis.lpush(signal_key, "go")
                    await redis.expire(signal_key, SIGNAL_TTL)

                    # ---- acknowledge ----
                    await redis.xack(stream_name, CONSUMER_GROUP, msg_id)

                    # ---- trim stream to bound memory ----
                    await redis.xtrim(stream_name, maxlen=STREAM_MAXLEN, approximate=True)

                    last_dispatch = time.monotonic()

        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "Dispenser error for model=%s — retrying in 1 s", model_id
            )
            await asyncio.sleep(1)


async def _claim_pending(
    redis,
    stream_key: str,
    consumer_id: str,
    rate_key: str,
    rpm: int,
    interval: float,
) -> None:
    """Reclaim and process pending messages, paced to *interval* so we
    don't flood the upstream provider on startup."""
    try:
        pending = await redis.xpending(stream_key, CONSUMER_GROUP)
        pending_count = pending.get("pending", 0) if isinstance(pending, dict) else 0
    except Exception:
        pending_count = 0

    if pending_count == 0:
        return

    logger.info(
        "🔀 Dispenser reclaiming %d pending messages for stream %s (paced at %.4fs)",
        pending_count,
        stream_key,
        interval,
    )

    try:
        claimed = await redis.xautoclaim(
            stream_key,
            CONSUMER_GROUP,
            consumer_id,
            min_idle_time=AUTOCLAIM_MIN_IDLE_MS,
            count=pending_count,
        )
        if isinstance(claimed, (list, tuple)) and len(claimed) >= 2:
            for msg_id, fields in claimed[1]:
                request_id = fields.get("request_id", "")
                if not request_id:
                    await redis.xack(stream_key, CONSUMER_GROUP, msg_id)
                    continue

                # Pace to RPM — don't burst all pending at once
                await asyncio.sleep(interval)

                await redis.zadd(rate_key, {request_id: time.time()})
                await redis.expire(rate_key, RATE_KEY_TTL)

                signal_key = f"{_SIGNAL_PREFIX}:{request_id}"
                await redis.lpush(signal_key, "go")
                await redis.expire(signal_key, SIGNAL_TTL)

                await redis.xack(stream_key, CONSUMER_GROUP, msg_id)

                await redis.xtrim(stream_key, maxlen=STREAM_MAXLEN, approximate=True)
    except Exception:
        logger.exception("Failed to reclaim pending messages for %s", stream_key)


# ===================================================================
# Lifecycle (called from server.py)
# ===================================================================


async def start_dispensers() -> None:
    """Launch one dispenser task per model that has an RPM cap."""
    global _dispenser_tasks

    # Short-circuit if Redis isn't available
    try:
        await get_redis()
    except Exception:
        logger.warning("Redis unavailable — upstream buckets disabled")
        return

    for model_id in _model_ids_with_rpm():
        model = get_model(model_id)
        if model is None or model.rpm is None:
            continue
        task = asyncio.create_task(
            _run_dispenser(model_id, model.rpm)
        )
        _dispenser_tasks[model_id] = task

    logger.info(
        "🔀 %d upstream dispenser(s) started",
        len(_dispenser_tasks),
    )


async def stop_dispensers() -> None:
    """Cancel all dispenser tasks gracefully."""
    global _dispenser_tasks
    for model_id, task in list(_dispenser_tasks.items()):
        task.cancel()
    if _dispenser_tasks:
        await asyncio.gather(*_dispenser_tasks.values(), return_exceptions=True)
    _dispenser_tasks.clear()
    logger.info("🔀 All upstream dispensers stopped")
