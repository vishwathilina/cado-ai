"use client";

import { useState } from "react";
import { FadeLoading, LoadingInline } from "@/components/page-transition";

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
          <LoadingInline className="mt-2" label="Searching Google Images like a browser…" />
        </div>
      );
    }
    return null;
  }

  return (
    <figure className="overflow-hidden rounded-xl bg-[var(--surface)]">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--surface-2)]">
        {!loaded && <FadeLoading className="absolute inset-0 rounded-none" />}
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
