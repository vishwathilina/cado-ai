import { cookies } from "next/headers";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const upload = createUploadthing();

function backendOrigin() {
  return (process.env.BACKEND_URL ?? "").replace(/\/$/, "");
}

function appOrigin() {
  const raw = (process.env.UPLOADTHING_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  return raw.replace(/\/$/, "");
}

function parseSetCookie(raw: string): { name: string; value: string; options: Record<string, unknown> } | null {
  const parts = raw.split(";").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const [nameValue, ...attributes] = parts;
  const eq = nameValue.indexOf("=");
  if (eq <= 0) return null;
  const name = nameValue.slice(0, eq);
  const value = nameValue.slice(eq + 1);
  const options: Record<string, unknown> = {
    path: "/",
    httpOnly: name !== "csrf_token",
    sameSite: "lax" as const,
  };
  for (const attribute of attributes) {
    const lower = attribute.toLowerCase();
    if (lower.startsWith("max-age=")) {
      const maxAge = Number(attribute.slice(8));
      if (Number.isFinite(maxAge)) options.maxAge = maxAge;
      continue;
    }
    if (lower === "secure") {
      options.secure = true;
      continue;
    }
    if (lower.startsWith("samesite=")) {
      const mode = attribute.split("=")[1]?.toLowerCase();
      if (mode === "lax" || mode === "strict" || mode === "none") options.sameSite = mode;
      continue;
    }
  }
  if (process.env.NODE_ENV === "production" || process.env.NETLIFY === "true") {
    options.secure = true;
  }
  return { name, value, options };
}

/** Page gate allows refresh_token alone; UploadThing previously required access_token only. */
async function ensureUploadSession() {
  const jar = await cookies();
  if (jar.get("access_token")?.value) return true;

  const refresh = jar.get("refresh_token")?.value;
  const csrf = jar.get("csrf_token")?.value;
  if (!refresh) return false;

  const backend = backendOrigin();
  if (!backend) return Boolean(refresh);

  const headers: Record<string, string> = {
    Cookie: [`refresh_token=${refresh}`, csrf ? `csrf_token=${csrf}` : ""].filter(Boolean).join("; "),
    "X-CSRF-Token": csrf || "",
  };
  const origin = appOrigin();
  if (origin) headers.Origin = origin;

  try {
    const response = await fetch(`${backend}/auth/refresh`, {
      method: "POST",
      headers,
      redirect: "manual",
    });
    if (!response.ok) return Boolean(refresh);
    const setCookies =
      typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const parsed = parseSetCookie(raw);
      if (!parsed) continue;
      jar.set(parsed.name, parsed.value, parsed.options);
    }
    return Boolean(jar.get("access_token")?.value || jar.get("refresh_token")?.value || refresh);
  } catch {
    return Boolean(refresh);
  }
}

export const fileRouter = {
  studyMaterial: upload({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    text: { maxFileSize: "8MB", maxFileCount: 1 },
    blob: { maxFileSize: "16MB", maxFileCount: 1 },
  })
    .middleware(async ({ files }) => {
      const ok = await ensureUploadSession();
      if (!ok) throw new UploadThingError("Sign in before uploading");
      const name = files[0]?.name?.toLowerCase() ?? "";
      if (!/\.(pdf|png|jpe?g|webp|txt|pptx)$/.test(name)) {
        throw new UploadThingError("Use a PDF, photo, TXT, or PPTX file");
      }
      return { authenticated: true };
    })
    .onUploadComplete(async ({ file }) => ({
      key: file.key,
      url: file.ufsUrl,
      name: file.name,
      type: file.type,
    })),
} satisfies FileRouter;

export type AppFileRouter = typeof fileRouter;
