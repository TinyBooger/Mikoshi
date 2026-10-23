# Mikoshi

## Aliyun SMS Verification

Phone verification codes are sent by the backend through Aliyun Dysmsapi
(`SendSms`). Configure these environment variables for both development and
production backend services:

- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- `ALIBABA_CLOUD_SMS_SIGN_NAME=语伴岛昆明人工智能应用软件有限公司`
- `ALIBABA_CLOUD_SMS_TEMPLATE_CODE=SMS_512506546`

The configured Aliyun account must have permission to call Dysmsapi and the
signature and template must be approved. The configured template must accept a
`code` variable; the current approved login template is `登录验证码`, with
content `您的验证码为：${code}，该验证码5分钟内有效，请勿泄露于他人！`.
The backend fills that variable with a six-digit code, expires it after five
minutes, and allows another request after 60 seconds.

The existing AccessKey variables remain in use; do not place credentials in
frontend configuration. The LoginPage continues calling the existing backend
verification endpoint. Its separate Aliyun human-verification CAPTCHA is not
the SMS provider and is unchanged.

## LLM Environment Variables

The chat stack uses OpenAI-compatible clients for multiple model providers:

- `DEEPSEEK_API_KEY` - required for DeepSeek chat models.
- `DEEPSEEK_BASE_URL` - optional, defaults to `https://api.deepseek.com`.
- `QWEN_API_KEY` - required for Aliyun Bailian Qwen models such as `qwen-plus`.
- `QWEN_BASE_URL` - optional, defaults to `https://dashscope.aliyuncs.com/compatible-mode/v1`.

## Migrations: Visibility, Forkable, and Pricing Flags

A migration script has been added to introduce the following fields:

- characters: `is_public` (bool), `is_forkable` (bool), `is_free` (bool)
- scenes: `is_public` (bool), `is_forkable` (bool)
- personas: `is_public` (bool), `is_forkable` (bool)

Defaults are private (false), non-forkable (false), and characters are free (true).

Run the migration (PostgreSQL):

```
python migrations/add_visibility_and_fork_flags.py
```

This script is idempotent and safe to run multiple times.
