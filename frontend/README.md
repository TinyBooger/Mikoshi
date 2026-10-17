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

## Landing-page pre-rendering

The production image builds both the browser app and a React server-rendering
entry. At container startup, `server.mjs` fetches the public popular-character
page from the backend, renders the same `/` route as the browser app, and
serves that HTML for `/`. The serialized character page is used by the browser
to hydrate the existing markup before client-side navigation and interactions
start. Other paths continue to receive the standard SPA shell.

`PRERENDER_API_BASE_URL` optionally changes the backend origin used for this
startup snapshot. It defaults to `http://localhost:8000` for local preview;
the production Compose service sets it to `http://backend:8000`.
The frontend waits for a valid public character response before starting, so
an unavailable backend is reported as a startup error rather than silently
serving an empty landing page. A new snapshot is generated on each container
start.

### About `Mikoshi.env`

There is a `Mikoshi.env` file under `frontend/` that is ignored by git and not loaded by Vite. It is not used by the frontend build or runtime. Do not put secrets in the frontend; anything in Vite `.env*` files with `VITE_` will be bundled and visible to clients. Keep server-only secrets in backend or `secrets/` and load them server-side.
