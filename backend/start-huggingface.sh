#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  python -m alembic upgrade head
fi

# End-to-end smoke test (db, embeddings, OCR, AI provider) so a broken
# service shows up clearly in the Space logs at boot instead of only when a
# user hits it. Never blocks startup: a flaky AI provider should not
# crash-loop the container. Skip with SKIP_E2E_CHECK=1 for faster restarts.
if [ "${SKIP_E2E_CHECK:-0}" != "1" ]; then
  python scripts/e2e_check.py || echo "e2e check: one or more services failed (see above) - starting anyway"
fi

exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-7860}"
