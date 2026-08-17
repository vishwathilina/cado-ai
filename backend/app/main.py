import time
from collections import defaultdict, deque

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import auth, dashboard, documents, learning, study
from app.config import settings

logger = structlog.get_logger()
app = FastAPI(title="Cado AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rate_buckets: dict[str, deque[float]] = defaultdict(deque)
csrf_exempt_prefixes = ("/auth/login", "/auth/register", "/health", "/ready", "/docs", "/openapi.json")
rate_limited_prefixes = ("/auth", "/study-sets/generate", "/vocabulary")


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
    if settings.environment != "test" and request.url.path.startswith(rate_limited_prefixes):
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
