# nginx configuration for Mikoshi

This folder contains example nginx configuration files you can use to run Mikoshi behind nginx (for production or staging).

Files
- `nginx.conf` - top-level nginx configuration (includes `conf.d/*.conf`).
- `conf.d/mikoshi.conf` - site configuration: proxies `/api/` and `/static/` to the `backend` service and serves the frontend build from `/usr/share/nginx/html` with an SPA fallback.

Usage (Docker Compose)

A simple example `nginx` service that serves a built frontend and proxies API requests to the backend:

```yaml
  nginx:
    image: nginx:stable-alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d/mikoshi.conf:/etc/nginx/conf.d/mikoshi.conf:ro
      # Mount your built frontend (vite build output) into nginx html dir
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
```

Notes
- The `mikoshi.conf` proxies `http://backend:8000` — this works on the same Docker Compose network where the backend service is named `backend`.
- If you prefer nginx to serve backend static uploads directly from a persistent volume, mount the uploads directory into nginx and adjust the `location /static/` block to `root` instead of proxying.
- If the project uses websockets in the future, add websocket proxy headers in the `/api/` block:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Validation
- To test locally without Docker, build the frontend (`npm run build` in `frontend`), then run nginx in Docker with the snippet above.
- To lint nginx configuration inside a running nginx container:

```powershell
# copy files into container or mount them, then run:
docker run --rm -v ${PWD}/nginx:/etc/nginx:ro nginx:stable-alpine nginx -t
```

If you want, I can:
- add a ready-to-use `docker-compose.prod.yml` containing the `nginx` service, or
- update the project's `README.md` with instructions for deploying with nginx.
