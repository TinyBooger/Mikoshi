# Mikoshi

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
