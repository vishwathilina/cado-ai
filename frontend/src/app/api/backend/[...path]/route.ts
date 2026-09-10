import { NextRequest, NextResponse } from "next/server";

const backendUrl = (process.env.BACKEND_URL ?? "").replace(/\/$/, "");

export const maxDuration = 300;

function collectSetCookies(upstream: Response): string[] {
  const typed = upstream.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof typed.getSetCookie === "function") {
    const cookies = typed.getSetCookie();
    if (cookies.length > 0) return cookies;
  }
  const single = upstream.headers.get("set-cookie");
  if (!single) return [];
  // Node may join multiple Set-Cookie values with ", " which is ambiguous for
  // Expires dates. Prefer getSetCookie when available; otherwise keep the raw
  // value as a single entry rather than splitting incorrectly.
  return [single];
}

function normalizeProxyCookie(raw: string): string {
  const parts = raw.split(";").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return raw;

  const [nameValue, ...attributes] = parts;
  const kept: string[] = [];
  let hasPath = false;
  let hasSameSite = false;
  let hasSecure = false;

  for (const attribute of attributes) {
    const lower = attribute.toLowerCase();
    if (lower.startsWith("domain=")) continue;
    if (lower.startsWith("path=")) {
      hasPath = true;
      kept.push("Path=/");
      continue;
    }
    if (lower.startsWith("samesite=")) {
      hasSameSite = true;
      kept.push("SameSite=Lax");
      continue;
    }
    if (lower === "secure") {
      hasSecure = true;
      kept.push("Secure");
      continue;
    }
    kept.push(attribute);
  }

  if (!hasPath) kept.push("Path=/");
  if (!hasSameSite) kept.push("SameSite=Lax");
  if (process.env.NODE_ENV === "production" || process.env.NETLIFY === "true") {
    if (!hasSecure) kept.push("Secure");
  }

  return [nameValue, ...kept].join("; ");
}

async function proxy(request: NextRequest, path: string[]) {
  if (!backendUrl) {
    return NextResponse.json({ detail: "BACKEND_URL is not set" }, { status: 503 });
  }
  const target = `${backendUrl}/${path.join("/")}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    });
  } catch (error) {
    const unreachable = error instanceof Error && "cause" in error
      ? String((error as Error & { cause?: { code?: string } }).cause?.code ?? error.message)
      : "backend unreachable";
    return NextResponse.json(
      { detail: `Cado API is not running at ${backendUrl}. Start it with uvicorn, then try again. (${unreachable})` },
      { status: 503 },
    );
  }
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
      return;
    }
    if (key.toLowerCase() === "set-cookie") return;
    responseHeaders.set(key, value);
  });
  for (const cookie of collectSetCookies(upstream)) {
    responseHeaders.append("set-cookie", normalizeProxyCookie(cookie));
  }
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}
