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

## Static shell and public-list caching

`npm run build` produces a browser-only bundle. `server.mjs` serves the built
`dist/` directory as a static shell: every route receives the same
`index.html`, which contains a `<link rel="preload" as="fetch">` plus a small
inline script that starts the popular-character request in parallel with the JS
bundle. Nothing is rendered at startup, so a slow or unavailable backend only
makes the first data request slower — it can never fail the frontend start.

Public lists (`/api/characters|scenes|personas/popular|recent`) are token-free
and identical for every viewer. The backend caches them in Redis and serves
them with `Cache-Control: public, s-maxage=30, stale-while-revalidate=300`;
nginx adds a shared `proxy_cache` in front of the same routes. Requests that
carry an `Authorization` header bypass that cache because they include per-user
like flags.

Personal state (liked/followed flags, credits, avatar) is a client-side overlay
fetched after login from `GET /api/me/interactions`, so it never changes the
cached markup and never shifts layout.

`PUBLIC_CACHE_DISABLED=1` in the backend environment bypasses the Redis layer
when debugging.

### About `Mikoshi.env`

There is a `Mikoshi.env` file under `frontend/` that is ignored by git and not loaded by Vite. It is not used by the frontend build or runtime. Do not put secrets in the frontend; anything in Vite `.env*` files with `VITE_` will be bundled and visible to clients. Keep server-only secrets in backend or `secrets/` and load them server-side.
