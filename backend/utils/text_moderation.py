import base64
import json
import os
import logging
from typing import Any, Dict, Iterable, Tuple

from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
from tencentcloud.tms.v20201229 import tms_client, models

logger = logging.getLogger(__name__)

_MAX_TEXT_LENGTH = 10000


def _debug_enabled() -> bool:
    return os.getenv("TEXT_MODERATION_DEBUG", "true").strip().lower() in {"1", "true", "yes", "on"}


def _fail_closed_enabled() -> bool:
    return os.getenv("TEXT_MODERATION_FAIL_CLOSED", "true").strip().lower() in {"1", "true", "yes", "on"}


def _debug_print(message: str) -> None:
    if not _debug_enabled():
        return
    print(message)
    logger.info(message)


def _service_error_decision(reason: str) -> Tuple[str, str]:
    if _fail_closed_enabled():
        _debug_print(f"[text_moderation] fail-closed: blocking submit due to {reason}")
        return "block", "ModerationServiceUnavailable"
    return "pass", ""


def _split_text_for_tms(text: str) -> Iterable[str]:
    if len(text) <= _MAX_TEXT_LENGTH:
        return [text]

    chunks = []
    for i in range(0, len(text), _MAX_TEXT_LENGTH):
        chunks.append(text[i:i + _MAX_TEXT_LENGTH])
    return chunks


def moderate_text_with_decision(text: str, data_id: str = "") -> Tuple[str, str]:
    if text is None:
        return "pass", ""

    text = str(text)
    if not text.strip():
        return "pass", ""

    secret_id = os.getenv("TENCENTCLOUD_SECRET_ID")
    secret_key = os.getenv("TENCENTCLOUD_SECRET_KEY")

    if not secret_id or not secret_key:
        _debug_print("[text_moderation] skipped: missing Tencent Cloud credentials")
        logger.warning(
            "text_moderation: TENCENTCLOUD_SECRET_ID / TENCENTCLOUD_SECRET_KEY not set. "
            "Skipping text content moderation."
        )
        return _service_error_decision("missing_credentials")

    region = os.getenv("TENCENTCLOUD_TMS_REGION", "ap-guangzhou")
    biz_type = os.getenv("TENCENTCLOUD_TMS_BIZ_TYPE", "")

    saw_review = False
    review_label = ""

    try:
        cred = credential.Credential(secret_id, secret_key)

        http_profile = HttpProfile()
        http_profile.endpoint = "tms.tencentcloudapi.com"

        client_profile = ClientProfile()
        client_profile.httpProfile = http_profile

        client = tms_client.TmsClient(cred, region, client_profile)

        for idx, chunk in enumerate(_split_text_for_tms(text), start=1):
            req = models.TextModerationRequest()
            params: Dict[str, Any] = {
                "Content": base64.b64encode(chunk.encode("utf-8")).decode("utf-8"),
                "SourceLanguage": "zh",
                "Type": "TEXT",
            }
            if biz_type:
                params["BizType"] = biz_type
            if data_id:
                params["DataId"] = f"{data_id}_{idx}"

            req.from_json_string(json.dumps(params, ensure_ascii=False))
            resp = client.TextModeration(req)

            suggestion = (resp.Suggestion or "").strip()
            label = resp.Label or ""
            score = resp.Score if resp.Score is not None else ""
            request_id = resp.RequestId or ""

            _debug_print(
                f"[text_moderation] result: suggestion={suggestion}, label={label}, score={score}, request_id={request_id}, chunk={idx}"
            )

            if suggestion == "Block":
                return "block", label
            if suggestion == "Review":
                saw_review = True
                review_label = label or review_label

        if saw_review:
            return "review", review_label
        return "pass", ""

    except TencentCloudSDKException as exc:
        _debug_print(f"[text_moderation] sdk_error: {exc}")
        logger.error("text_moderation: TencentCloudSDKException: %s", exc)
        return _service_error_decision("sdk_error")


def moderate_form_payload_with_review(payload: Dict[str, Any]) -> Tuple[bool, bool, str, str, str, str]:
    """
    Returns:
        (is_safe, needs_review, blocked_field, blocked_label, review_field, review_label)
    """
    review_field = ""
    review_label = ""

    for field_name, field_value in payload.items():
        if isinstance(field_value, str):
            decision, label = moderate_text_with_decision(field_value, data_id=f"field_{field_name}")
            if decision == "block":
                return False, False, field_name, label, "", ""
            if decision == "review" and not review_field:
                review_field = field_name
                review_label = label
            continue

        if isinstance(field_value, list):
            for idx, item in enumerate(field_value):
                if not isinstance(item, str):
                    continue
                decision, label = moderate_text_with_decision(item, data_id=f"field_{field_name}_{idx}")
                if decision == "block":
                    return False, False, field_name, label, "", ""
                if decision == "review" and not review_field:
                    review_field = field_name
                    review_label = label

    return True, bool(review_field), "", "", review_field, review_label
