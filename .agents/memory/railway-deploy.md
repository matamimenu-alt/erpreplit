---
name: Railway deployment setup
description: How this monorepo deploys to Railway and the constraints that shaped it
---

# Railway deployment

- Single Railway service: api-server serves the built SPA from `dist/public` (copied there by root `build:railway` script); frontend calls the API same-origin via relative BASE_URL, so no CORS/proxy needed.
- `railway.json` uses RAILPACK, healthcheck `/api/healthz`, `preDeployCommand: pnpm run db:push` (non-destructive). `db:push:force` exists for manual recovery only — never wire it into predeploy (architect flagged this as a production-safety issue).
- Both `db:push` scripts guard on `DATABASE_URL` being set and fail with a clear message (Railway needs a Postgres service linked).
- **Why:** Replit dev and Railway prod differ: vite.config must not throw when PORT/BASE_PATH are absent, and the SPA-serving middleware in app.ts is a no-op on Replit (dir doesn't exist in dev).
- **How to apply:** After changing frontend build output or API mount paths, re-verify locally with `pnpm run build:railway` then `PORT=4999 pnpm run start:railway` and curl `/api/healthz`, `/`, and a client route.
