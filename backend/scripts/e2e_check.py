#!/usr/bin/env python
"""End-to-end smoke test for every service the backend depends on.

Checks, in order: database connectivity, the local embeddings model,
Tesseract OCR, and the configured AI provider (a real, cheap completion
call) — the same pieces involved in "upload a file -> generate a set".

Usage:
    python scripts/e2e_check.py            # all checks
    python scripts/e2e_check.py --no-ai    # skip the AI provider call
    python scripts/e2e_check.py --no-ocr   # skip the Tesseract check

Exit code is 0 only if every check passes. This never blocks the app from
starting — start-huggingface.sh logs the report but always starts uvicorn,
so a temporarily down AI provider does not crash-loop the container.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.diagnostics import run_diagnostics  # noqa: E402


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-ai", action="store_true", help="skip the AI provider check")
    parser.add_argument("--no-ocr", action="store_true", help="skip the Tesseract OCR check")
    parser.add_argument("--json", action="store_true", help="print the raw JSON report only")
    args = parser.parse_args()

    report = await run_diagnostics(include_ai=not args.no_ai, include_ocr=not args.no_ocr)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print("=== Cado AI end-to-end service check ===")
        for name, result in report["services"].items():
            status = "OK    " if result["ok"] else "FAILED"
            detail = result.get("detail") or result.get("error")
            print(f"[{status}] {name:<12} {detail}  ({result['duration_ms']}ms)")
        print("=== " + ("all services healthy" if report["ok"] else "one or more services FAILED") + " ===")

    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
