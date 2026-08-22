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
| `JWT_SECRET` | ≥ 32 characters |
| `FRONTEND_URL` | Exact frontend origin, e.g. `https://your-app.netlify.app` |
| `AI_BASE_URL` | OpenAI-compatible base including `/v1` |
| `AI_API_KEY` | Provider key |
| `AI_MODEL` | Chat model id |
| `UPLOADTHING_TOKEN` | Optional, for uploads |

`EMBEDDING_MODEL=BAAI/bge-m3` is baked into the image. The container listens on **7860**.
