# Workspace instructions

## Product naming

- The product's user-facing name is **语伴岛**. Any string a user can see (emails, notifications, SMS copy, page text, share cards, etc.) must use 语伴岛 — never "Mikoshi".
- "Mikoshi" is only the internal/repository name: keep it for repo/directory names, container/service names, code identifiers, env file names (`secrets/Mikoshi.env`), comments, and logs.
- In backend Python, reuse the shared brand constant instead of hardcoding the name (for example `BRAND_NAME` in `backend/utils/email_utils.py`).

## Validation defaults

- Do not run `npm run build` after frontend changes unless the user explicitly requests it.
- Do not run terminal commands to check backend Python syntax unless the user explicitly requests it.
- Continue to run focused tests or other validation explicitly requested by the user.

## Dependency installs

- Package installs are handled manually by the user. Never run `npm install`, `pip install`, or similar commands.
- When new dependencies are needed, list the exact packages and the command the user should run, then stop.

## File deletion policy

- Never delete or rename files via terminal commands (`Remove-Item`, `rm`, `mv`, etc.).
- If a file needs to be deleted or renamed, tell the user which file and why, and let them handle it manually.
