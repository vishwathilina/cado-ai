export type StudyItem = {
  id: string;
  kind: "explanation" | "mcq" | "flashcard";
  position: number;
  prompt: string;
  answer: string;
  options: string[] | null;
  explanation: string | null;
  full_explanation?: string | null;
  image_search_query?: string | null;
  image_url?: string | null;
  imageSearchQuery?: string | null;
  imageUrl?: string | null;
};

export type StudySet = {
  id: string;
  title: string;
  language: string;
  created_at: string;
  items: StudyItem[];
  explanation_count?: number;
  flashcard_count?: number;
  mcq_count?: number;
};

export type TutorImage = {
  url: string;
  caption: string;
  credit: string;
};

export type TutorCitation = {
  n: number;
  kind: "notes" | "web" | string;
  title: string;
  snippet: string;
  quote: string;
  page: number | null;
  url: string | null;
};

export type TutorReply = {
  reply: string;
  image: TutorImage | null;
  origin: "notes" | "web" | string;
  citations: TutorCitation[];
  document_url: string | null;
  document_title: string;
  mime_type: string;
  elapsed_ms: number;
};

export type DocumentRecord = {
  id: string;
  title: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  language: string;
  error: string | null;
  created_at: string;
};

const noRefresh = new Set(["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"]);

let refreshInFlight: Promise<boolean> | null = null;
let sentToLogin = false;

export function csrfToken() {
  if (typeof document === "undefined") return "";
  const entry = document.cookie.split("; ").find((item) => item.startsWith("csrf_token="));
  return entry ? decodeURIComponent(entry.slice("csrf_token=".length)) : "";
}

function request(path: string, init?: RequestInit) {
  return fetch(`/api/backend${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken(),
      ...init?.headers,
    },
  });
}

async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = request("/auth/refresh", { method: "POST" })
      .then((response) => response.ok)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function goToLogin() {
  if (typeof window === "undefined" || sentToLogin) return;
  const path = window.location.pathname;
  if (path.startsWith("/login") || path.startsWith("/register")) return;
  sentToLogin = true;
  window.location.replace("/login");
}

async function readError(response: Response) {
  const body = await response.json().catch(() => ({ detail: "Something went wrong" }));
  const detail = body.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(" ") || "Something went wrong";
  }
  return "Something went wrong";
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await readError(response));
  if (response.status === 204) return undefined as T;
  return response.json();
}

const inflightGets = new Map<string, Promise<unknown>>();

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET") {
    const pending = inflightGets.get(path);
    if (pending) return pending as Promise<T>;
  }
  const pending = sendApi<T>(path, init);
  if (method === "GET") {
    inflightGets.set(path, pending);
    void pending.finally(() => {
      if (inflightGets.get(path) === pending) inflightGets.delete(path);
    });
  }
  return pending;
}

async function sendApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init);
  if (response.status === 401 && !noRefresh.has(path.split("?")[0] ?? path)) {
    if (await refreshSession()) return parseResponse<T>(await request(path, init));
    goToLogin();
    throw new Error("Please sign in again");
  }
  return parseResponse<T>(response);
}
