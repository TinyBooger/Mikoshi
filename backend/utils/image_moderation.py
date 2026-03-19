import os
import base64
import json
import logging

from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
from tencentcloud.ims.v20201229 import ims_client, models

logger = logging.getLogger(__name__)

# Maximum Base64 content size Tencent IMS accepts is 10 MB
_MAX_BASE64_BYTES = 10 * 1024 * 1024


def _debug_enabled() -> bool:
    return os.getenv("IMAGE_MODERATION_DEBUG", "true").strip().lower() in {"1", "true", "yes", "on"}


def _debug_print(message: str) -> None:
    if not _debug_enabled():
        return
    print(message)
    logger.info(message)


def moderate_image(image_bytes: bytes) -> tuple[bool, str]:
    """
    Submit image bytes to Tencent Cloud Image Moderation Service (IMS).

    Returns:
        (is_safe, label)
        - is_safe: True if the image passed (Suggestion == "Pass" or "Review"),
                   False if blocked (Suggestion == "Block").
        - label:   The top-level label returned by the API (e.g. "Porn", "Terror",
                   "Normal"), or an empty string when the API is unavailable.

    If the IMS credentials are not configured, the function returns (True, "")
    so uploads are not blocked in environments that have not yet set up the
    integration.  Log a warning so operators are aware.
    """
    secret_id = os.getenv("TENCENTCLOUD_SECRET_ID")
    secret_key = os.getenv("TENCENTCLOUD_SECRET_KEY")

    if not secret_id or not secret_key:
        _debug_print("[image_moderation] skipped: missing Tencent Cloud credentials")
        logger.warning(
            "image_moderation: TENCENTCLOUD_SECRET_ID / TENCENTCLOUD_SECRET_KEY not set. "
            "Skipping image content moderation."
        )
        return True, ""

    region = os.getenv("TENCENTCLOUD_IMS_REGION", "ap-guangzhou")
    biz_type = os.getenv("TENCENTCLOUD_IMS_BIZ_TYPE", "")

    # Tencent IMS rejects payloads whose base64 content exceeds 10 MB.
    # Silently allow oversized images here; the caller should enforce an
    # upload size limit independently.
    b64_content = base64.b64encode(image_bytes).decode("utf-8")
    if len(b64_content.encode("utf-8")) > _MAX_BASE64_BYTES:
        _debug_print(
            f"[image_moderation] skipped: base64 payload too large ({len(b64_content)} bytes)"
        )
        logger.warning(
            "image_moderation: image too large for IMS (%d bytes base64), skipping moderation.",
            len(b64_content),
        )
        return True, ""

    try:
        cred = credential.Credential(secret_id, secret_key)

        http_profile = HttpProfile()
        http_profile.endpoint = "ims.tencentcloudapi.com"

        client_profile = ClientProfile()
        client_profile.httpProfile = http_profile

        client = ims_client.ImsClient(cred, region, client_profile)

        req = models.ImageModerationRequest()
        params: dict = {"FileContent": b64_content}
        if biz_type:
            params["BizType"] = biz_type
        req.from_json_string(json.dumps(params))

        resp = client.ImageModeration(req)

        suggestion = resp.Suggestion  # "Pass" | "Review" | "Block"
        label = resp.Label or ""
        score = resp.Score if resp.Score is not None else ""
        request_id = resp.RequestId or ""

        _debug_print(
            f"[image_moderation] result: suggestion={suggestion}, label={label}, score={score}, request_id={request_id}"
        )

        if suggestion == "Block":
            logger.info("image_moderation: image blocked. Label=%s", label)
            return False, label

        return True, label

    except TencentCloudSDKException as exc:
        _debug_print(f"[image_moderation] sdk_error: {exc}")
        # Fail open: do not block uploads when the moderation service is
        # temporarily unavailable, but do log the error.
        logger.error("image_moderation: TencentCloudSDKException: %s", exc)
        return True, ""
