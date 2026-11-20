# Workspace instructions

## Product naming

- The product's user-facing name is **语伴岛**. Any string a user can see (emails, notifications, SMS copy, page text, share cards, etc.) must use 语伴岛 — never "Mikoshi".
- "Mikoshi" is only the internal/repository name: keep it for repo/directory names, container/service names, code identifiers, env file names (`secrets/Mikoshi.env`), comments, and logs.
- In backend Python, reuse the shared brand constant instead of hardcoding the name (for example `BRAND_NAME` in `backend/utils/email_utils.py`).

## Local development environment

- Local dev does **not** use Docker. `start-dev.bat` runs the backend as `cd backend && call venv\Scripts\activate && python server.py` and the frontend as `cd frontend && npm run dev`.
- So locally: the backend is a native Windows process (venv at `backend/venv`), not a container. Never give `docker compose` commands for local dev — those apply to `docker-compose.dev.yml`/`docker-compose.prod.yml` deployments only.
- Backend paths are Windows paths. A container-style path such as `/tmp/x.json` resolves against the current drive root (`D:\tmp\x.json`), never inside the repo — prefer repo-relative paths or `%TEMP%` for local diagnostics.

## Terminal usage

- Avoid running command-line commands in the terminal unless necessary. Prefer reading files, searching, and inspecting with non-terminal tools; use the terminal only when no better tool exists or when the user asks for it.

## Validation defaults

- Do not run `npm run build` after frontend changes unless the user explicitly requests it.
- Do not run terminal commands to check backend Python syntax unless the user explicitly requests it.
- Continue to run focused tests or other validation explicitly requested by the user.

## Runtime verification limits

- Do not probe for or start dev servers: no port scans, `Test-NetConnection`, `curl` against localhost, or launching `start-dev.bat` / `npm run dev` / `python server.py`.
- Do not open, navigate, screenshot, or interact with browser pages — including `file://` pages created for verification. Do not create throwaway HTML harnesses for visual checks.
- Do not connect to, query, or inspect databases (no `sqlite3`, no SQL clients, no backend scripts that touch the DB).
- Verify frontend and backend behavior by reading code and reasoning about it, then state plainly what was not verified at runtime and let the user confirm in their own running app.

## Dependency installs

- Package installs are handled manually by the user. Never run `npm install`, `pip install`, or similar commands.
- When new dependencies are needed, list the exact packages and the command the user should run, then stop.

## File deletion policy

- Never delete or rename files via terminal commands (`Remove-Item`, `rm`, `mv`, etc.).
- If a file needs to be deleted or renamed, tell the user which file and why, and let them handle it manually.
