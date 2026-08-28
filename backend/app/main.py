import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

import structlog
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.deps import current_user
from app.api.routes import auth, dashboard, documents, learning, study
from app.config import settings
from app.models import User
from app.services.diagnostics import run_diagnostics
from app.services.embeddings import warm_embeddings

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.environment != "test":
        logger.info("loading_local_embeddings", model=settings.embedding_model)
        await warm_embeddings()
        logger.info("embeddings_ready", model=settings.embedding_model)
    yield


app = FastAPI(title="Cado AI API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rate_buckets: dict[str, deque[float]] = defaultdict(deque)
csrf_exempt_prefixes = (
    "/auth/login",
    "/auth/register",
    "/auth/logout",
    "/auth/refresh",
    "/health",
    "/ready",
    "/docs",
    "/openapi.json",
)
rate_limited_prefixes = ("/auth", "/study-sets/generate", "/vocabulary", "/diagnostics")


def _is_csrf_exempt(path: str) -> bool:
    return any(path == prefix or path.startswith(f"{prefix}/") for prefix in csrf_exempt_prefixes)


@app.middleware("http")
async def security_and_rate_limits(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if origin and origin != settings.frontend_url:
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        if not _is_csrf_exempt(request.url.path):
            csrf_cookie = request.cookies.get("csrf_token")
            csrf_header = request.headers.get("x-csrf-token")
            if not csrf_cookie or csrf_cookie != csrf_header:
                return JSONResponse({"detail": "CSRF check failed"}, status_code=403)
    if settings.environment != "test" and (
        request.url.path.startswith(rate_limited_prefixes) or request.url.path.endswith("/tutor")
    ):
        now = time.monotonic()
        key = f"{request.client.host if request.client else 'unknown'}:{request.url.path}"
        bucket = rate_buckets[key]
        while bucket and bucket[0] < now - 60:
            bucket.popleft()
        limit = 10 if request.url.path.startswith("/auth") else 20
        if len(bucket) >= limit:
            return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)
        bucket.append(now)
    started = time.monotonic()
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    logger.info(
        "request_complete",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round((time.monotonic() - started) * 1000, 2),
    )
    return response


app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(study.router)
app.include_router(learning.router)
app.include_router(dashboard.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    return {"status": "ready"}


@app.get("/diagnostics")
async def diagnostics(_user: User = Depends(current_user)) -> dict:
    """Live check of every dependency (DB, embeddings, OCR, AI provider).

    Requires a logged-in session so it can't be used to hammer the AI
    provider anonymously. Hit this on the hosted deployment when something
    is stuck, instead of guessing from request logs.
    """
    return await run_diagnostics()
