export type StudyItem = {
  id: string;
  kind: "explanation" | "mcq" | "flashcard";
  position: number;
  prompt: string;
  answer: string;
  options: string[] | null;
  explanation: string | null;
};

export type StudySet = {
  id: string;
  title: string;
  language: string;
  created_at: string;
  items: StudyItem[];
};

export type DocumentRecord = {
  id: string;
  title: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  language: string;
  error: string | null;
  created_at: string;
};

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("csrf_token="))
    ?.split("=")[1] ?? "";
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken(),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "Something went wrong" }));
    const detail = body.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(" ")
          : "Something went wrong";
    throw new Error(message || "Something went wrong");
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
