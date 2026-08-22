import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

describe("api client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns JSON and sends same-origin credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(api<{ status: string }>("/health")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/health",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("surfaces backend detail messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Document is not ready" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(api("/study-sets/generate")).rejects.toThrow("Document is not ready");
  });

  it("refreshes an expired session and retries", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "user" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ).mockResolvedValueOnce(
      new Response(JSON.stringify({ title: "Today" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api<{ title: string }>("/dashboard")).resolves.toEqual({ title: "Today" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/backend/auth/refresh", expect.anything());
  });

  it("does not refresh failed login attempts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid email or password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(api("/auth/login", { method: "POST" })).rejects.toThrow("Invalid email or password");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
