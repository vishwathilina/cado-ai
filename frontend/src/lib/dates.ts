export function isoDate(value: Date | string = new Date()) {
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function prettyDate(value: string, style: "short" | "long" = "short") {
  if (!value) return "";
  return parseIsoDate(value).toLocaleDateString(undefined, {
    weekday: style === "long" ? "long" : "short",
    month: style === "long" ? "long" : "short",
    day: "numeric",
    ...(style === "long" ? { year: "numeric" } : {}),
  });
}

export function monthDay(value: string) {
  if (!value) return "";
  return parseIsoDate(isoDate(value)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
