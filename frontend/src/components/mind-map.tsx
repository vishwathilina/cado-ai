"use client";

import { useState } from "react";

type MindNode = {
  id: string;
  prompt: string;
  answer: string;
};

function shortAnswer(text: string) {
  const clean = text.trim();
  // take first 140 chars, cut at sentence
  if (clean.length <= 120) return clean;
  const cut = clean.slice(0, 120);
  const lastDot = cut.lastIndexOf(".");
  return (lastDot > 60 ? cut.slice(0, lastDot + 1) : cut.trim() + "…");
}

function truncatePrompt(prompt: string, limit = 48) {
  if (prompt.length <= limit) return prompt;
  return prompt.slice(0, limit - 1).trim() + "…";
}

export function MindMap({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: MindNode[];
  onSelect?: (id: string) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const n = items.length;
  const radius = n <= 6 ? 170 : n <= 8 ? 190 : 210;
  // center is 50% 50%
  const cx = 400;
  const cy = 260;

  if (!n) return null;

  return (
    <div className="space-y-4">
      {/* Graph */}
      <div className="card overflow-hidden p-0">
        <div className="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <p className="kicker">Mind map · A-Z short notes</p>
          <p className="text-xs font-semibold muted">{n} ideas · Full coverage</p>
        </div>

        {/* Desktop circular graph */}
        <div className="hidden md:block relative h-[520px] w-full overflow-hidden bg-[var(--surface)]">
          {/* subtle grid */}
          <div className="absolute inset-0 stars opacity-[0.35] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--surface)] pointer-events-none" />

          {/* SVG lines */}
          <svg
            viewBox="0 0 800 520"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            {items.map((_, i) => {
              const angle = (-90 + (i * 360) / n) * (Math.PI / 180);
              const x = cx + Math.cos(angle) * radius;
              const y = cy + Math.sin(angle) * radius;
              const isActive = active === items[i].id;
              return (
                <g key={items[i].id}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={x}
                    y2={y}
                    stroke={isActive ? "var(--primary)" : "var(--border)"}
                    strokeWidth={isActive ? 2.5 : 1.6}
                    strokeLinecap="round"
                    opacity={isActive ? 1 : 0.9}
                  />
                  {/* small branch dots */}
                  <circle cx={x} cy={y} r={3.5} fill={isActive ? "var(--primary)" : "var(--muted)"} opacity={0.9} />
                </g>
              );
            })}
            {/* glow center */}
            <circle cx={cx} cy={cy} r={54} fill="var(--primary)" opacity={0.08} />
          </svg>

          {/* Center node */}
          <div
            className="absolute z-10 grid place-items-center rounded-2xl border bg-[var(--primary)] text-white shadow-lg"
            style={{
              left: cx,
              top: cy,
              width: 140,
              height: 86,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="px-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest opacity-90">Document</p>
              <p className="mt-1 text-sm font-extrabold leading-tight line-clamp-2">{truncatePrompt(title, 52)}</p>
            </div>
          </div>

          {/* Idea nodes */}
          {items.map((item, i) => {
            const angle = (-90 + (i * 360) / n) * (Math.PI / 180);
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setActive(item.id)}
                onMouseLeave={() => setActive(null)}
                onClick={() => {
                  setActive(item.id);
                  onSelect?.(item.id);
                  document.getElementById(`note-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className={`absolute z-10 w-[158px] -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-3 text-left shadow-sm transition ${
                  isActive
                    ? "bg-[var(--surface)] border-[var(--primary)] ring-2 ring-[var(--primary)]/20"
                    : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/40 hover:shadow-md"
                }`}
                style={{ left: x, top: y }}
              >
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--primary)]">
                  {String.fromCharCode(65 + (i % 26))} · Idea {i + 1}
                </p>
                <p className="mt-1 text-[13px] font-bold leading-tight line-clamp-2">{item.prompt}</p>
                <p className="muted mt-1 line-clamp-2 text-[11px] leading-snug">{shortAnswer(item.answer)}</p>
              </button>
            );
          })}

          {/* legend */}
          <div className="absolute bottom-3 left-3 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[11px] font-semibold muted border border-[var(--border)]">
            Hover → highlight · Click → jump to note
          </div>
        </div>

        {/* Mobile vertical tree */}
        <div className="md:hidden p-4 space-y-3 bg-[var(--surface)]">
          <div className="mx-auto max-w-sm rounded-2xl bg-[var(--primary)] p-4 text-center text-white shadow">
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-90">Document</p>
            <p className="mt-1 font-extrabold leading-snug">{title}</p>
            <p className="mt-1 text-xs opacity-90">{n} ideas · A-Z</p>
          </div>
          <div className="relative pl-5">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[var(--border)]" />
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect?.(item.id);
                  document.getElementById(`note-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="relative mb-3 flex w-full items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-left"
              >
                <span className="absolute -left-[18px] top-5 h-2.5 w-2.5 rounded-full border-2 border-[var(--primary)] bg-[var(--surface)]" />
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--surface)] text-xs font-extrabold text-[var(--primary)] flex-shrink-0">
                  {String.fromCharCode(65 + (i % 26))}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight">{item.prompt}</span>
                  <span className="muted mt-1 block text-xs leading-snug line-clamp-2">{shortAnswer(item.answer)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* A-Z short notes list */}
      <div className="card p-4 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold tracking-tight">A-Z short notes · all ideas condensed</h3>
          <span className="hidden sm:inline text-xs muted font-semibold">{n} notes</span>
        </div>
        <p className="muted mt-1 text-xs leading-relaxed">
          Full mode = entire document condensed A-Z. Each note is 2–4 short sentences — skim in order, then use the mind map above to see connections.
        </p>
        <ol className="mt-4 grid gap-3">
          {items.map((item, i) => (
            <li
              key={item.id}
              id={`note-${item.id}`}
              className={`scroll-mt-6 rounded-xl border p-4 transition ${active === item.id ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]" : "border-[var(--border)] bg-[var(--surface-2)]"}`}
              onMouseEnter={() => setActive(item.id)}
              onMouseLeave={() => setActive(null)}
            >
              <div className="flex gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--primary)] text-xs font-extrabold text-white flex-shrink-0">
                  {String.fromCharCode(65 + (i % 26))}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold leading-snug">
                    {i + 1}. {item.prompt}
                  </p>
                  <p className="mt-2 text-[14px] leading-7">{item.answer}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
