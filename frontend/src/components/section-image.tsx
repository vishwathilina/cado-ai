"use client";

import { useState } from "react";

export function SectionImage({
  url,
  query,
  alt,
}: {
  url?: string | null;
  query?: string | null;
  alt?: string;
}) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!url || err) {
    if (query) {
      return (
        <div className="overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="text-xs font-bold uppercase tracking-widest muted">Context image</p>
          <p className="mt-1 text-xs font-semibold muted">Finding: “{query}”</p>
          <div className="mt-2 h-24 animate-pulse rounded-lg bg-[var(--border)]/50" />
          <p className="mt-2 text-[11px] muted">Searching Google Images like a browser…</p>
        </div>
      );
    }
    return null;
  }

  return (
    <figure className="overflow-hidden rounded-xl bg-[var(--surface)]">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--surface-2)]">
        {!loaded && <div className="absolute inset-0 animate-pulse bg-[var(--border)]/50" />}
        <img
          src={url}
          alt={alt || query || "Context illustration"}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
          className={`h-full w-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      </div>
      {query && <figcaption className="px-3 py-2 text-xs font-medium muted">“{query}” · via Google Images · https</figcaption>}
    </figure>
  );
}
