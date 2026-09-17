"""AI image generation for character artwork.

Backed by Aliyun Bailian (DashScope) Qwen-Image. Image models are *not*
available through the OpenAI-compatible mode, so this deliberately bypasses
`utils/llm_client.py` and talks to the native text-to-image endpoint instead.
"""

from __future__ import annotations

import base64
import logging
import os
import uuid
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from database import get_db
from models import User
from utils.credit_cap import (
    build_credit_cap_reached_payload,
    can_consume_credits,
    get_credit_cap_info,
)
from utils.credit_usage_ledger import apply_fixed_credit_usage_with_wallet
from utils.model_rate_limiter import rate_limiter
from utils.session import get_current_user
from utils.user_utils import is_upload_banned

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Native DashScope text-to-image endpoint (Beijing / China mainland). The legacy
# public domain is still served and is the one QWEN_API_KEY is issued for. The
# newer per-workspace host (`https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/...`)
# can be supplied through QWEN_IMAGE_API_URL instead.
DASHSCOPE_IMAGE_API_URL = os.getenv(
    "QWEN_IMAGE_API_URL",
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
)

# qwen-image-3.0 is the current recommended 文生图 model and uses the same
# synchronous multimodal-generation endpoint. Override with QWEN_IMAGE_MODEL to
# switch to qwen-image-2.0-pro, qwen-image-max, qwen-image-plus, etc.
DEFAULT_IMAGE_MODEL = os.getenv("QWEN_IMAGE_MODEL", "qwen-image-3.0")

# qwen-image-3.0 accepts free width*height as long as the total pixel count is
# within 512x512 - 2048x2048, so this preset list is comfortably inside its
# budget. The same five values are also the only ones qwen-image-max /
# qwen-image-plus accept, which keeps the allow-list valid for every supported
# model.
ALLOWED_IMAGE_SIZES = {
    "1664*928",   # 16:9
    "1472*1104",  # 4:3
    "1328*1328",  # 1:1
    "1104*1472",  # 3:4
    "928*1664",   # 9:16
}
DEFAULT_IMAGE_SIZE = "1328*1328"

# DashScope silently truncates over-long prompts, so reject early instead of
# paying for a mangled one.
MAX_PROMPT_LENGTH = 800
MAX_NEGATIVE_PROMPT_LENGTH = 500

# NOTE: there is deliberately no DEFAULT_NEGATIVE_PROMPT here. The negative
# prompt sent to DashScope is always exactly what the client supplied, so the
# text a user sees in the UI is the text that is actually applied. The
# recommended value lives in frontend/src/components/ImageGenerateModal.jsx.

GENERATE_TIMEOUT_SECONDS = 180.0
DOWNLOAD_TIMEOUT_SECONDS = 60.0

# Cost billed to the user per generated image, in credits (点数).
#
# The internal rate is 1 credit = ¥0.001 (see ModelConfig.tokens_to_credits), so
# 200 credits = ¥0.20 against a real provider cost of ¥0.18 per image — the
# rounded-up price, which is the intended margin.
#
# Mind the plan caps in utils/credit_cap.py when changing this: the free daily
# cap defaults to 10 credits, so a free user can afford at most one image per
# day at this price, and a pro's monthly 10000-credit quota buys 50 images.
IMAGE_GENERATION_CREDIT_COST = float(os.getenv("IMAGE_GENERATION_CREDIT_COST", "200"))


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=MAX_PROMPT_LENGTH)
    size: Optional[str] = None
    negative_prompt: Optional[str] = Field(default=None, max_length=MAX_NEGATIVE_PROMPT_LENGTH)
    model: Optional[str] = None


def _extract_image_url(payload: dict) -> Optional[str]:
    """Pull the generated image URL out of a multimodal-generation response.

    `message.content` is a list that may interleave {"text": ...} blocks with the
    {"image": ...} block, so scan for the first mapping that carries an image.
    """
    output = payload.get("output") or {}
    for choice in output.get("choices") or []:
        message = (choice or {}).get("message") or {}
        for item in message.get("content") or []:
            if isinstance(item, dict) and item.get("image"):
                return item["image"]
    return None


def _call_dashscope(prompt: str, size: str, negative_prompt: str, model: str) -> dict:
    """Blocking DashScope call + result download.

    Always invoked through `run_in_threadpool` so the event loop is not blocked
    for the 10-30s an image generation takes.
    """
    api_key = os.getenv("QWEN_API_KEY") or os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="图片生成服务未配置（缺少 QWEN_API_KEY）。",
        )

    body = {
        "model": model,
        "input": {
            "messages": [
                {"role": "user", "content": [{"text": prompt}]},
            ]
        },
        "parameters": {
            "size": size,
            "prompt_extend": True,
            "watermark": False,
            # `negative_prompt` is optional. Omit the key entirely rather than
            # sending "" so that "no negative prompt" is unambiguous to the
            # provider and cannot be reinterpreted as a default.
            **({"negative_prompt": negative_prompt} if negative_prompt else {}),
        },
    }

    try:
        response = requests.post(
            DASHSCOPE_IMAGE_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=GENERATE_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        logger.error("image_generation: DashScope request failed: %s", exc)
        raise HTTPException(status_code=502, detail="图片生成服务暂时不可用，请稍后重试。")

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if response.status_code != 200:
        code = payload.get("code") or f"HTTP {response.status_code}"
        message = payload.get("message") or ""
        logger.error("image_generation: DashScope error %s: %s", code, message)
        if code == "DataInspectionFailed":
            raise HTTPException(status_code=400, detail="提示词未通过内容审核，请修改后重试。")
        if code == "InvalidParameter":
            # Surface the provider text: unsupported model/size/parameter combos
            # are the usual cause and are otherwise hard to diagnose.
            raise HTTPException(status_code=400, detail=f"图片生成参数有误：{message}")
        if response.status_code == 429 or str(code).startswith("Throttling"):
            raise HTTPException(status_code=429, detail="图片生成请求过于频繁，请稍后再试。")
        raise HTTPException(status_code=502, detail="图片生成失败，请稍后重试。")

    image_url = _extract_image_url(payload)
    if not image_url:
        logger.error("image_generation: no image in DashScope response: %s", payload)
        raise HTTPException(status_code=502, detail="图片生成失败，请稍后重试。")

    # Result URLs expire after 24 hours, so fetch the bytes now and hand the
    # client a self-contained data URL. The form re-uploads it as a normal file
    # on submit, which keeps the on-disk cleanup path unchanged.
    try:
        image_response = requests.get(image_url, timeout=DOWNLOAD_TIMEOUT_SECONDS)
        image_response.raise_for_status()
    except requests.RequestException as exc:
        logger.error("image_generation: downloading result failed: %s", exc)
        raise HTTPException(status_code=502, detail="图片生成成功但下载失败，请重试。")

    mime = (image_response.headers.get("Content-Type") or "image/png").split(";")[0].strip()
    encoded = base64.b64encode(image_response.content).decode("ascii")

    return {
        "image": f"data:{mime or 'image/png'};base64,{encoded}",
        "model": model,
        "size": size,
    }


@router.post("/api/generate-image")
async def generate_image(
    payload: GenerateImageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a character image from a text prompt.

    Billed at a flat `IMAGE_GENERATION_CREDIT_COST`. Affordability is checked
    *before* the provider call so a user who cannot pay never costs us money,
    and the charge is applied *after* success so a failed generation is free.
    """
    if is_upload_banned(current_user):
        raise HTTPException(status_code=403, detail="UPLOAD_BANNED")

    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="提示词不能为空。")

    size = (payload.size or DEFAULT_IMAGE_SIZE).strip()
    if size not in ALLOWED_IMAGE_SIZES:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的图片尺寸：{size}。",
        )

    model = (payload.model or DEFAULT_IMAGE_MODEL).strip() or DEFAULT_IMAGE_MODEL

    # Omitted (None) and empty both mean "no negative prompt". No default is
    # substituted: the caller decides, and the frontend always sends an explicit
    # value so there is never a hidden prompt the user did not see.
    negative_prompt = (payload.negative_prompt or "").strip()

    # -- Credit pre-check ----------------------------------------------------
    # `can_consume_credits` only reports whether *any* wallet credit remains, not
    # whether there is enough for this request, so the wallet case needs an
    # explicit balance comparison. Without it a user with 5 credits could pass
    # the check, get a ¥0.18 image generated, and then fail to be charged.
    cost = IMAGE_GENERATION_CREDIT_COST
    credit_check = can_consume_credits(current_user, db)
    credit_limit_info = credit_check.get("limit") or {}
    if credit_check.get("blocked"):
        return JSONResponse(
            content=build_credit_cap_reached_payload(credit_limit_info),
            status_code=429,
        )
    if credit_check.get("consume_from_wallet"):
        wallet_balance = float(credit_limit_info.get("purchased_credit_balance") or 0.0)
        if wallet_balance < cost:
            return JSONResponse(
                content={
                    "error": "INSUFFICIENT_WALLET_CREDITS",
                    "message": (
                        f"钱包点数不足，生图需要 {cost:g} 点数，当前余额 {wallet_balance:g}。"
                        "请充值后再试。"
                    ),
                    "required_credits": cost,
                    "wallet_balance": wallet_balance,
                    "credit_limits": credit_limit_info,
                },
                status_code=429,
            )

    # Image generation is the most expensive per-request call in the app, so it
    # shares the per-user LLM rate-limit window rather than adding a new one.
    rate_limit_result = await rate_limiter.check(
        current_user.id,
        is_pro=bool(current_user.is_pro),
    )
    if not rate_limit_result["allowed"]:
        raise HTTPException(
            status_code=429,
            detail="请求过于频繁，请稍后再试。",
            headers={"Retry-After": str(max(1, rate_limit_result["reset_seconds"]))},
        )

    result = await run_in_threadpool(_call_dashscope, prompt, size, negative_prompt, model)

    # -- Charge on success ---------------------------------------------------
    # Deliberately after the provider call: a generation that failed (moderation,
    # provider error, download error) must not be billed. A rejection raised
    # above never reaches this point.
    usage_result = apply_fixed_credit_usage_with_wallet(
        db,
        user=current_user,
        credit_amount=cost,
        source="image_generation",
        idempotency_key=f"image_generation:{uuid.uuid4()}",
        metadata={"model": model, "size": size},
    )
    if usage_result.get("success"):
        db.commit()
        credit_limit_info = get_credit_cap_info(current_user, db)
        logger.info(
            "✅ Image generation charged | user=%s | credits=%.2f | "
            "consumed_from_wallet=%s | wallet_balance_after=%.2f",
            current_user.id,
            cost,
            usage_result.get("consumed_from_wallet", False),
            float(usage_result.get("wallet_balance") or 0.0),
        )
    else:
        # The pre-check above makes this a race only (e.g. two concurrent
        # requests draining the same wallet). We have already paid the provider,
        # so the image is returned rather than discarded — the user is not
        # penalised for a server-side race — and the loss is logged instead.
        db.rollback()
        logger.error(
            "image_generation: charge failed after successful generation | "
            "user=%s | credits=%.2f | error=%s",
            current_user.id,
            cost,
            usage_result.get("error"),
        )

    return {
        **result,
        "credit_amount": cost if usage_result.get("success") else 0.0,
        "credit_limits": credit_limit_info,
    }
