---
title: Cado AI API
emoji: 🥑
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
---

# Cado AI on Hugging Face

Docker Space that runs the FastAPI backend and **BAAI/bge-m3** embeddings in-process.

Use `Dockerfile.huggingface` as the Space `Dockerfile` (copy or rename it to `Dockerfile` in the Space repo). Pick a CPU Space with **at least 16 GB RAM** so BGE-M3 can load.

## Space secrets

Set these in the Space **Settings → Variables and secrets**:

| Name | Notes |
| --- | --- |
| `DATABASE_URL` | Neon pooled Postgres URL (`postgresql+asyncpg://...` or `postgresql://...`) |
| `JWT_SECRET` | ≥ 32 characters; keep stable or every user is logged out |
| `FRONTEND_URL` | Exact frontend origin users open, e.g. `https://your-app.netlify.app` (no trailing `/`; must match browser `Origin`) |
| `COOKIE_SECURE` | `true` on HTTPS (already set in `Dockerfile.huggingface`; do not override to `false` in production) |
| `ACCESS_TOKEN_MINUTES` | `1440` (24h access cookie / JWT) |
| `REFRESH_TOKEN_DAYS` | `7` (refresh can renew the 24h access token within a week) |
| `AI_BASE_URL` | OpenAI-compatible base including `/v1` |
| `AI_API_KEY` | Provider key |
| `AI_MODEL` | Chat model id |
| `UPLOADTHING_TOKEN` | Optional; file bytes are stored by UploadThing on the frontend host |

`EMBEDDING_MODEL=BAAI/bge-m3` is baked into the image. The container listens on **7860**.

## Netlify frontend pairing

On Netlify set:

| Name | Notes |
| --- | --- |
| `BACKEND_URL` | This Space origin, no trailing slash |
| `UPLOADTHING_TOKEN` | UploadThing app token |
| `UPLOADTHING_URL` | Same origin as `FRONTEND_URL` above |
| `UPLOADTHING_IS_DEV` | `false` |

Redeploy Netlify after changing env vars.

## Verify session + upload

1. Log in on the Netlify site → DevTools → Application → Cookies: `access_token`, `refresh_token`, `csrf_token` with `Secure`, `Path=/`, `SameSite=Lax`, and a `Max-Age`.
2. Upload a small file → Network: `/api/uploadthing` completes, then `/api/backend/documents/upload-complete` runs (progress leaves ~24%).
3. Hard refresh later the same day → still authenticated.
