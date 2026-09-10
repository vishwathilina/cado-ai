import { NextRequest, NextResponse } from "next/server";
import { createRouteHandler } from "uploadthing/next";
import { fileRouter } from "./core";

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NETLIFY === "true" ||
    process.env.CONTEXT === "production"
  );
}

function normalizeCallbackUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("/api/uploadthing")) return trimmed;
  return `${trimmed.replace(/\/$/, "")}/api/uploadthing`;
}

function envCallbackUrl() {
  return normalizeCallbackUrl(process.env.UPLOADTHING_URL ?? "");
}

function requestCallbackUrl(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  if (!host) return undefined;
  const origin = `${proto}://${host}`.replace(/\/$/, "");
  try {
    const hostname = new URL(origin).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") return undefined;
  } catch {
    return undefined;
  }
  return `${origin}/api/uploadthing`;
}

function useDevHook(callback?: string) {
  if (process.env.UPLOADTHING_IS_DEV === "true") return true;
  if (process.env.UPLOADTHING_IS_DEV === "false") return false;
  if (isProductionRuntime()) return false;
  const host = callback || process.env.UPLOADTHING_URL || "";
  if (!host) return true;
  try {
    const hostname = new URL(host.includes("://") ? host : `https://${host}`).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return !isProductionRuntime();
  }
}

function missingCallbackResponse() {
  return NextResponse.json(
    {
      detail:
        "UPLOADTHING_URL is not set. On Netlify set UPLOADTHING_URL to your public HTTPS origin (e.g. https://your-app.netlify.app) and UPLOADTHING_IS_DEV=false, then redeploy.",
    },
    { status: 500 },
  );
}

function handlersFor(callbackUrl: string | undefined) {
  return createRouteHandler({
    router: fileRouter,
    config: {
      isDev: useDevHook(callbackUrl),
      callbackUrl,
    },
  });
}

async function handle(request: NextRequest, method: "GET" | "POST") {
  const callbackUrl = envCallbackUrl() ?? requestCallbackUrl(request);
  if (isProductionRuntime() && !callbackUrl) {
    return missingCallbackResponse();
  }
  const { GET, POST } = handlersFor(callbackUrl);
  return method === "GET" ? GET(request) : POST(request);
}

export async function GET(request: NextRequest) {
  return handle(request, "GET");
}

export async function POST(request: NextRequest) {
  return handle(request, "POST");
}
