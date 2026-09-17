# Integrations

## CAPTCHA (Aliyun)
- Backend: Install dependencies in backend/requirements.txt.
- Configure credentials in secrets/Mikoshi.env.
- Test with backend/test_captcha_config.py.
- Frontend: Add AliyunCaptchaConfig to index.html and integrate in WelcomePage.jsx.

## Alipay
- Supports both real and mock payment providers.
- Configure via environment variables.
- See provider documentation for sandbox and production setup.

## Qwen-Image (AI 图片生成)
- Provider: Aliyun Bailian / DashScope, native text-to-image API (image models are **not** available in OpenAI-compatible mode).
- Configure `QWEN_API_KEY` in `secrets/Mikoshi.env` (and `secrets/Mikoshi-production.env`). Optional: `QWEN_IMAGE_MODEL` (default `qwen-image-3.0`, alternatives `qwen-image-2.0-pro`, `qwen-image-max`, `qwen-image-plus`), `QWEN_IMAGE_API_URL` (override the endpoint, e.g. the per-workspace host).
- Endpoint: `POST /api/generate-image` (authenticated, per-user LLM rate limit, blocked for upload-banned users).
  - Request: `{ "prompt": "...", "size": "1328*1328", "negative_prompt": "...", "model": "..." }` — prompt ≤800 chars, negative_prompt ≤500 chars.
  - `negative_prompt` is optional. Omitting it and sending `""` are equivalent: both mean *no* negative prompt. The backend applies no default of its own — the recommended value is defined only in `ImageGenerateModal.jsx` and is pre-filled into the textarea when the user enables it, so the text shown is always the text sent.
  - Response: `{ "image": "data:image/png;base64,...", "model": "...", "size": "..." }` — the DashScope result is downloaded and re-encoded as a self-contained data URL because provider URLs expire after 24 hours.
- Size: `qwen-image-3.0` accepts free `width*height` as long as the total pixels stay within 512×512–2048×2048, so the five offered presets are all valid. `qwen-image-plus` / `qwen-image-max` accept only those same five (`1664*928` 16:9, `1472*1104` 4:3, `1328*1328` 1:1 default, `1104*1472` 3:4, `928*1664` 9:16).
- Errors: `DataInspectionFailed` → 400 (prompt failed content moderation), `InvalidParameter` → 400 (provider message surfaced), `Throttling` / 429 → 429, other failures → 502.
- Frontend: `frontend/src/components/ImageGenerateModal.jsx`, opened from the 角色图片 section of `frontend/src/pages/CharacterFormPage.jsx`.
- Billing: a flat **200 credits (点数)** per generation, via `IMAGE_GENERATION_CREDIT_COST` (env-overridable). At the internal rate of 1 credit = ¥0.001 that is ¥0.20 against a ¥0.18 provider cost.
  - Charged **after** a successful generation, so failures (moderation, provider error, download error) are free; affordability is checked **before** the provider call so an unpayable user never costs money.
  - The wallet case compares the balance against the cost explicitly, because `can_consume_credits` only reports whether *any* wallet credit remains.
  - Failure payloads use the shared credit codes: `CREDIT_CAP_REACHED` (429, `build_credit_cap_reached_payload`) and `INSUFFICIENT_WALLET_CREDITS` (429).
  - ⚠️ 200 credits exceeds the default `FREE_DAILY_CREDIT_CAP` of 10, so a free user can afford at most **one image per day** and is then blocked until the noon reset. A pro's default 10000-credit monthly quota buys 50 images.
