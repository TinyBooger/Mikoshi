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

## 邮件推送 (Aliyun DirectMail)
- 用途：
  - 登录时通过邮箱找回密码（`POST /api/send-reset-code-email` → `POST /api/verify-reset-code-email` → `POST /api/reset-password-with-token`）。
  - 设置页更换绑定邮箱的激活验证（`POST /api/change-email/send-code` → `POST /api/change-email/confirm`）。两步均需登录态（`Authorization: <session token>`）：第一步校验邮箱格式/占用并向新邮箱发送验证码，第二步校验验证码后才写入新邮箱。原有的无需验证的 `POST /api/change-email` 已移除。
- 发信方式：SMTP，实现在 `backend/utils/email_utils.py`（`smtplib`）；密码重置路由在 `backend/routes/password.py`，更换邮箱路由在 `backend/routes/user.py`。
- 配置：在 `secrets/Mikoshi.env` 设置 `ALIBABA_CLOUD_DM_ACCOUNT_NAME`（控制台创建的**发信地址**）与 `ALIBABA_CLOUD_DM_SMTP_PASSWORD`（该发信地址对应的 **SMTP 密码**，非 AccessKey）。
  - 可选：`ALIBABA_CLOUD_DM_SENDER_NICKNAME`（默认 `语伴岛`）、`ALIBABA_CLOUD_DM_REPLY_TO`。
  - 可选：`ALIBABA_CLOUD_DM_SMTP_HOST`（默认 `smtpdm.aliyun.com`）、`ALIBABA_CLOUD_DM_SMTP_PORT`（默认 `465`）、`ALIBABA_CLOUD_DM_SMTP_SSL`（默认：465 端口启用 SSL，其余端口禁用）。如需 25/80 明文端口，请同时设置 `ALIBABA_CLOUD_DM_SMTP_SSL=false`。
- 行为：验证码为 6 位数字，5 分钟有效，同一邮箱 60 秒内只能发送一次；发送失败不会写入缓存，因此不会触发冷却。
- 品牌：用户可见文案统一使用产品名「语伴岛」（`email_utils.BRAND_NAME`，同时作为发件人昵称默认值）；`Mikoshi` 仅作为代码/仓库名，不得出现在邮件主题与正文中。
- 降级：未配置邮件服务时，非生产环境把验证码打印到后端日志（并仅在非生产环境的响应中返回 `code`）；生产环境返回“邮件服务未配置”，不会泄露验证码。
- Python 3.10/3.11 的 SSL 握手兼容处理已内置（`ssl.create_default_context().set_ciphers('DEFAULT')`）。
- 注意：验证码缓存在进程内存中（`email_utils.verification_codes`），多进程/多实例部署时需替换为 Redis 等共享存储。

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
