# Mikoshi Frontend

## Environment variables

This app uses Vite. Environment variables are loaded from standard Vite files in the project root:

- `.env` (base for all modes)
- `.env.development`
- `.env.production`
- `.env.local` (git-ignored)

Only variables prefixed with `VITE_` are exposed to the browser at build time.

Current variables used by the app:

- `VITE_API_BASE_URL` – Optional. If empty in production, the frontend will call same-origin (e.g. `/api/...` via Nginx).

See `.env.example` for a template.

### About `Mikoshi.env`

There is a `Mikoshi.env` file under `frontend/` that is ignored by git and not loaded by Vite. It is not used by the frontend build or runtime. Do not put secrets in the frontend; anything in Vite `.env*` files with `VITE_` will be bundled and visible to clients. Keep server-only secrets in backend or `secrets/` and load them server-side.

