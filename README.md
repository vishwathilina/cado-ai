# Cado AI

Cado AI turns a student's PDFs, PowerPoint decks, text files, and photographed notes into short explanations, interactive
4–5 option quizzes, animated flashcards, vocabulary help, and a personalized study plan.

## Stack

- Next.js 16, React 19, Tailwind CSS, Framer Motion, UploadThing
- FastAPI, SQLAlchemy 2, Alembic, secure cookie JWT sessions
- Neon PostgreSQL with pgvector
- PyMuPDF and Tesseract OCR
- Local `BAAI/bge-m3` embeddings (1024-d) and an OpenAI-compatible text model

The retrieval pipeline is intentionally direct rather than LlamaIndex-based: extraction,
chunking, embedding, vector retrieval, and typed generation are small isolated services.
LlamaIndex can be added later if Cado needs many external connectors or agentic retrieval.

## Local setup

1. Use Node 22+ and Python 3.11–3.13. Install Tesseract (`tesseract-ocr`) for photo and scanned
   PDF support.
2. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to
   `frontend/.env.local`. Add your Neon, UploadThing, and OpenAI-compatible credentials.
3. Enable the `vector` extension in Neon. The first migration also attempts to enable it.
4. Install and migrate the backend:

   ```bash
   cd backend
   python -m venv .venv
   . .venv/bin/activate
   pip install -e ".[embeddings,ocr,dev]"
   alembic upgrade head
   uvicorn app.main:app --reload
   ```

5. Start the frontend in another terminal:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Open `http://localhost:3000`, create an account, upload a PDF/photo, choose study formats, and
generate a set. Browser API calls stay on the Next.js origin and are rewritten to FastAPI so
HTTP-only session cookies remain first-party.

## Secrets

Do not commit `backend/.env` or `frontend/.env`. Those files hold database URLs, JWT secrets,
API keys, and UploadThing tokens. Copy the example files instead:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Git ignores both real env files. Only `.env.example` templates are tracked.

## Environment notes

- `AI_BASE_URL` must include the provider's API prefix (commonly `/v1`).
- Neon `postgresql://` URLs are accepted; the API converts them to `postgresql+asyncpg://` and maps `sslmode` for asyncpg.
- `AI_MODEL` must support JSON response mode through an OpenAI-compatible Chat Completions API.
- Never expose `AI_API_KEY`, Neon credentials, or `UPLOADTHING_TOKEN` through `NEXT_PUBLIC_*`.
- Set `COOKIE_SECURE=true` in production and use HTTPS.
- `BAAI/bge-m3` creates 1024-dimensional vectors from the copy already on this machine
  (`~/.cache/huggingface/hub`). The API will not download it again. Changing the embedding
  model can require a new vector column migration and full re-index.

## Checks

```bash
cd frontend && npm run lint && npm test && npx tsc --noEmit
cd backend && python -m pytest
```

Backend integration tests can use a disposable pgvector-enabled PostgreSQL database and mocked
AI/UploadThing responses. Unit tests intentionally avoid live paid services.

## Deployment

Deploy the frontend to Vercel or Netlify. This app is not a static export: `/dashboard`,
`/learn/...`, and `/api/backend/...` need the Next.js runtime. On Netlify use the included
`netlify.toml` (publish `.next`, plugin `@netlify/plugin-nextjs`). If the site shows Netlify’s
“Page not found”, the publish directory is wrong or the Next.js plugin is missing — set **Base
directory** to `frontend`, **Publish** to `.next`, then clear cache and redeploy. Set `BACKEND_URL`
to the FastAPI origin.

Deploy FastAPI to a persistent, worker-capable container host (Railway, Render, Fly.io, ECS, or
similar). OCR and BGE-M3 embeddings are too memory/CPU heavy for most short-lived serverless
functions.

Run `alembic upgrade head` as a release step. For higher upload volume, move
`ingest_document` from FastAPI background tasks to a durable worker queue and replace the
single-process rate limiter with Redis. Health probes are available at `/health` and `/ready`.

The included Dockerfiles build both services. `backend/Dockerfile.huggingface` is a Hugging Face
Docker Space image: it listens on port **7860** and downloads **BAAI/bge-m3** at build time. Copy
it as `Dockerfile` in the Space repo and set secrets from `backend/README.space.md`.
`docker-compose.yml` also provides local pgvector PostgreSQL; point `DATABASE_URL` at `postgres`
when using that compose stack.
