export function safeQuizNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/quiz/")) return null;
  if (value.includes("://") || value.startsWith("//") || value.includes("\\") || value.includes("?")) return null;
  return value;
}
