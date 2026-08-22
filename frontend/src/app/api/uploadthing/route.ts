import { createRouteHandler } from "uploadthing/next";
import { fileRouter } from "./core";

function callbackUrl() {
  const raw = process.env.UPLOADTHING_URL?.trim();
  if (!raw) return undefined;
  if (raw.includes("/api/uploadthing")) return raw;
  return `${raw.replace(/\/$/, "")}/api/uploadthing`;
}

function useDevHook() {
  if (process.env.UPLOADTHING_IS_DEV === "true") return true;
  if (process.env.UPLOADTHING_IS_DEV === "false") return false;
  const host = process.env.UPLOADTHING_URL || "";
  if (!host) return true;
  try {
    const hostname = new URL(host).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return true;
  }
}

export const { GET, POST } = createRouteHandler({
  router: fileRouter,
  config: {
    isDev: useDevHook(),
    callbackUrl: callbackUrl(),
  },
});
