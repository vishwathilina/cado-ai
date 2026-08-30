"use client";

import { motion, AnimatePresence } from "framer-motion";
import { SectionImage } from "@/components/section-image";
import {
  ArrowRight01Icon,
  Copy01Icon,
  Tick02Icon,
  Search01Icon,
  ViewIcon,
  GridViewIcon,
  Layers01Icon,
  FullScreenIcon,
  Download01Icon,
  Share08Icon,
  Link02Icon,
} from "@hugeicons/core-free-icons";
import { useMemo, useState, useRef } from "react";
import { Icon } from "@/components/icon";
import { VocabularyText } from "@/components/vocabulary-text";

type MindNode = {
  id: string;
  prompt: string;
  answer: string;
  imageSearchQuery?: string | null;
  imageUrl?: string | null;
  image_search_query?: string | null;
  image_url?: string | null;
};

type ViewMode = "radial" | "flow" | "grid" | "connected";

const PALETTE = ["#4f8a3a", "#f3803b", "#6a7cff", "#e85d75", "#0ea5a0", "#8b5cf6", "#f59e0b", "#06b6d4"];

const STOP = new Set([
  "the","and","for","are","with","that","this","from","have","has","had","was","were","will","would","can","could","should",
  "about","into","through","between","under","over","after","before","which","while","also","such","more","most","some","any",
  "your","their","there","they","them","then","than","what","when","where","how","why","not","but","all","each","our","out",
  "use","used","using","just","very","been","being","does","did","doing","because","per","via","etc","one","two","three",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)),
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function shortAnswer(text: string, len = 118) {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= len) return clean;
  const cut = clean.slice(0, len);
  const dot = cut.lastIndexOf(".");
  return (dot > 55 ? cut.slice(0, dot + 1) : cut.trim() + "…");
}

function readingTime(text: string) {
  const words = text.split(/\s+/).length;
  const secs = Math.max(12, Math.round((words / 180) * 60));
  return secs < 60 ? `${secs}s` : `${Math.round(secs / 60)}m`;
}
function titleTrunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trim() + "…" : s;
}

export function MindMap({
  title,
  items,
  onSelect,
  vocab,
}: {
  title: string;
  items: MindNode[];
  onSelect?: (id: string) => void;
  vocab?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("connected");
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState(1);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const n = items.length;

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const needle = q.toLowerCase();
    return items.filter((it) => it.prompt.toLowerCase().includes(needle) || it.answer.toLowerCase().includes(needle));
  }, [items, q]);

  const progress = done.size;
  const pct = n ? Math.round((progress / n) * 100) : 0;

  const toggleDone = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  const toggleFull = () => {
    if (!wrapRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current.requestFullscreen();
  };

  if (!n) return null;

  const cx = 400;
  const cy = 262;
  const radius = n <= 6 ? 168 : n <= 8 ? 188 : 208;

  // Connected Papers — similarity graph + force layout
  const connected = useMemo(() => {
    const nodes = filtered.map((it) => {
      const origIdx = items.findIndex((x) => x.id === it.id);
      const ang = (origIdx * 2 * Math.PI) / Math.max(n, 1);
      const r = 78 + ((origIdx * 37) % 88);
      return {
        id: it.id,
        prompt: it.prompt,
        answer: it.answer,
        imageUrl: (it as any).imageUrl || (it as any).image_url || null,
        imageSearchQuery: (it as any).imageSearchQuery || (it as any).image_search_query || null,
        origIdx,
        x: cx + Math.cos(ang) * r + (Math.random() - 0.5) * 18,
        y: cy + Math.sin(ang) * r * 0.72 + (Math.random() - 0.5) * 18,
        vx: 0,
        vy: 0,
        tokens: tokenize(`${it.prompt} ${it.answer}`),
      };
    });
    type Edge = { a: number; b: number; w: number };
    const edges: Edge[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const s = jaccard(nodes[i].tokens as Set<string>, nodes[j].tokens as Set<string>);
        if (s > 0.13) edges.push({ a: i, b: j, w: s });
      }
    }
    const deg = new Array(nodes.length).fill(0);
    for (const e of edges) { deg[e.a]++; deg[e.b]++; }
    for (let i = 0; i < nodes.length; i++) if (deg[i] === 0) {
      let best = -1, bestJ = -1;
      for (let j = 0; j < nodes.length; j++) if (j !== i) {
        const s = jaccard(nodes[i].tokens as Set<string>, nodes[j].tokens as Set<string>);
        if (s > best) { best = s; bestJ = j; }
      }
      if (bestJ !== -1) edges.push({ a: i, b: bestJ, w: Math.max(0.08, best) });
    }
    const kRep = 4200;
    const kAttr = 0.042;
    const ideal = 132;
    const centerPull = 0.008;
    const damp = 0.82;
    for (let iter = 0; iter < 180; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d2 = dx * dx + dy * dy + 0.01;
          const d = Math.sqrt(d2);
          const f = kRep / d2;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          nodes[i].vx += fx; nodes[i].vy += fy;
          nodes[j].vx -= fx; nodes[j].vy -= fy;
        }
      }
      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const f = kAttr * (d - ideal) * (0.6 + e.w);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
      for (const nn of nodes) {
        nn.vx += (cx - nn.x) * centerPull;
        nn.vy += (cy - nn.y) * centerPull;
        nn.vx *= damp; nn.vy *= damp;
        nn.x += nn.vx; nn.y += nn.vy;
        nn.x = Math.max(72, Math.min(728, nn.x));
        nn.y = Math.max(54, Math.min(506, nn.y));
      }
    }
    const comp = new Array(nodes.length).fill(-1);
    let cid = 0;
    for (let i = 0; i < nodes.length; i++) if (comp[i] === -1) {
      const q2 = [i]; comp[i] = cid;
      while (q2.length) {
        const u = q2.pop()!;
        for (const e of edges) if (e.w > 0.15) {
          const v = e.a === u ? e.b : e.b === u ? e.a : -1;
          if (v !== -1 && comp[v] === -1) { comp[v] = cid; q2.push(v); }
        }
      }
      cid++;
    }
    return { nodes, edges, comp };
  }, [filtered, items, n]);

  return (
    <div className="space-y-5">
      {/* TOP CONTROLS */}
      <div className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-3 md:px-4">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
              <Icon icon={Layers01Icon} size={16} />
            </span>
            <div>
              <p className="text-sm font-extrabold leading-none tracking-tight">A-Z Mind Map</p>
              <p className="hidden sm:block text-xs muted font-medium">{n} ideas · {pct}% done · ~{items.reduce((a, it) => a + it.answer.split(/\s+/).length, 0) / 180 | 0 || 2}m read</p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {/* view switch */}
            <div className="flex rounded-full bg-[var(--surface-2)] p-1">
              {[
                { id: "connected" as ViewMode, label: "Connected", ic: Share08Icon },
                { id: "radial" as ViewMode, label: "Radial", ic: ViewIcon },
                { id: "flow" as ViewMode, label: "Flow", ic: ArrowRight01Icon },
                { id: "grid" as ViewMode, label: "Grid", ic: GridViewIcon },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    view === v.id ? "bg-[var(--surface)] shadow text-[var(--foreground)]" : "text-[var(--muted)]"
                  }`}
                >
                  <Icon icon={v.ic as any} size={14} /> {v.label}
                </button>
              ))}
            </div>

            {/* search */}
            <div className="relative hidden md:block">
              <Icon icon={Search01Icon} size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ideas…"
                className="h-8 w-36 rounded-full border border-[var(--border)] bg-[var(--surface)] pl-7 pr-3 text-xs font-medium placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none lg:w-44"
              />
            </div>

            <button onClick={() => setZoom((z) => Math.min(1.25, +(z + 0.1).toFixed(2)))} className="hidden md:grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-bold hover:bg-[var(--surface-2)]">+</button>
            <button onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.1).toFixed(2)))} className="hidden md:grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-bold hover:bg-[var(--surface-2)]">−</button>
            <button onClick={toggleFull} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]">
              <Icon icon={FullScreenIcon} size={16} />
            </button>
          </div>
        </div>

        {/* progress bar */}
        <div className="h-1 w-full bg-[var(--surface-2)]">
          <motion.div className="h-full bg-[var(--primary)]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
        </div>

        <div ref={wrapRef} className="bg-[var(--surface)]">
          {/* RADIAL */}
          {view === "radial" && (
            <div className="relative hidden h-[560px] w-full overflow-hidden md:block" style={{ zoom: zoom } as any}>
              <div className="absolute inset-0 stars opacity-[0.22] pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-[var(--primary)]/[0.04] via-transparent to-transparent pointer-events-none" />

              <svg viewBox="0 0 800 560" className="absolute inset-0 h-full w-full" aria-hidden>
                {/* sequential flow dashed */}
                {filtered.map((_, i) => {
                  if (i === filtered.length - 1) return null;
                  const a1 = (-90 + (i * 360) / filtered.length) * (Math.PI / 180);
                  const a2 = (-90 + ((i + 1) * 360) / filtered.length) * (Math.PI / 180);
                  const x1 = cx + Math.cos(a1) * radius;
                  const y1 = cy + Math.sin(a1) * radius;
                  const x2 = cx + Math.cos(a2) * radius;
                  const y2 = cy + Math.sin(a2) * radius;
                  const mx = (x1 + x2) / 2;
                  const my = (y1 + y2) / 2;
                  const dx = mx - cx;
                  const dy = my - cy;
                  const ox = mx + (dx * 0.12);
                  const oy = my + (dy * 0.12);
                  return <path key={`seq-${i}`} d={`M ${x1} ${y1} Q ${ox} ${oy} ${x2} ${y2}`} fill="none" stroke="var(--border)" strokeWidth={1.2} strokeDasharray="6 6" opacity={0.45} />;
                })}
                {filtered.map((_, i) => {
                  // need original index for position calc to keep stable layout even when filtered
                  const origIdx = items.findIndex((x) => x.id === filtered[i].id);
                  const angle = (-90 + (origIdx * 360) / n) * (Math.PI / 180);
                  const x = cx + Math.cos(angle) * radius;
                  const y = cy + Math.sin(angle) * radius;
                  const isActive = active === filtered[i].id;
                  const col = PALETTE[origIdx % PALETTE.length];
                  return (
                    <g key={filtered[i].id}>
                      <motion.line
                        x1={cx}
                        y1={cy}
                        x2={x}
                        y2={y}
                        stroke={isActive ? col : "var(--border)"}
                        strokeWidth={isActive ? 2.6 : 1.7}
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: isActive ? 1 : 0.9 }}
                        transition={{ duration: 0.6, delay: i * 0.04 }}
                      />
                      <motion.circle
                        cx={x}
                        cy={y}
                        r={4}
                        fill={isActive ? col : "var(--surface)"}
                        stroke={isActive ? col : "var(--muted)"}
                        strokeWidth={1.8}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.03, type: "spring", stiffness: 260, damping: 18 }}
                      />
                    </g>
                  );
                })}
                <motion.circle cx={cx} cy={cy} r={58} fill="var(--primary)" opacity={0.09} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.5, ease: "easeOut" }} />
                <circle cx={cx} cy={cy} r={2.5} fill="var(--primary)" />
              </svg>

              {/* center */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute z-10 grid place-items-center rounded-[1.35rem] border border-white/20 bg-gradient-to-br from-[var(--primary)] to-[#3d6e2c] text-white shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
                style={{ left: cx, top: cy, width: 148, height: 92, transform: "translate(-50%, -50%)" }}
              >
                <div className="px-3 text-center">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] opacity-90">Central Topic</p>
                  <p className="mt-1 line-clamp-2 text-sm font-extrabold leading-tight">{title}</p>
                  <p className="mt-1 text-[11px] font-semibold opacity-80">{n} branches</p>
                </div>
              </motion.div>

              {/* nodes */}
              {filtered.map((item, i) => {
                const origIdx = items.findIndex((x) => x.id === item.id);
                const angle = (-90 + (origIdx * 360) / n) * (Math.PI / 180);
                const x = cx + Math.cos(angle) * radius;
                const y = cy + Math.sin(angle) * radius;
                const isActive = active === item.id;
                const isDone = done.has(item.id);
                const col = PALETTE[origIdx % PALETTE.length];
                return (
                  <motion.button
                    key={item.id}
                    initial={{ scale: 0.85, opacity: 0, y: 6 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 + i * 0.04, type: "spring", stiffness: 260, damping: 20 }}
                    onMouseEnter={() => setActive(item.id)}
                    onMouseLeave={() => setActive(null)}
                    onClick={() => {
                      setActive(item.id);
                      onSelect?.(item.id);
                      document.getElementById(`note-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }}
                    className={`absolute z-10 w-[172px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-[var(--surface)] p-3.5 text-left shadow-[0_6px_20px_rgba(0,0,0,0.08)] transition-all hover:shadow-[0_10px_28px_rgba(0,0,0,0.13)] hover:-translate-y-1 ${
                      isActive ? "ring-2" : ""
                    }`}
                    style={
                      {
                        left: x,
                        top: y,
                        borderColor: isActive ? col : "var(--border)",
                        boxShadow: isActive ? `0 0 0 3px ${col}22` : undefined,
                      } as any
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="grid h-6 w-6 place-items-center rounded-full text-xs font-black text-white" style={{ background: col }}>
                        {String.fromCharCode(65 + (origIdx % 26))}
                      </span>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: col }}>
                        Branch {origIdx + 1}
                      </span>
                      <span className="ml-auto text-[10px] muted font-bold">{readingTime(item.answer)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[13.5px] font-extrabold leading-tight">{item.prompt}</p>
                    <p className="muted mt-1 line-clamp-2 text-[11.5px] leading-snug">{shortAnswer(item.answer)}</p>
                    {(item.imageUrl || (item as any).image_url) ? (
                      <img
                        src={(item.imageUrl || (item as any).image_url) as string}
                        alt={(item.imageSearchQuery || (item as any).image_search_query || item.prompt) as string}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="mt-2 h-14 w-full rounded-lg object-cover border border-[var(--border)]"
                      />
                    ) : (item.imageSearchQuery || (item as any).image_search_query) ? (
                      <p className="mt-1 truncate text-[10px] italic muted">“{item.imageSearchQuery || (item as any).image_search_query}” · finding…</p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-1">
                      <span className={`h-1.5 flex-1 rounded-full ${isDone ? "bg-[var(--success)]" : "bg-[var(--surface-2)]"}`} />
                      <span className={`h-1.5 w-8 rounded-full ${isDone ? "bg-[var(--success)]" : "bg-[var(--surface-2)]"}`} />
                    </div>
                  </motion.button>
                );
              })}

              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[11px] font-bold muted shadow-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" /> Hover to focus · Click to jump · Dashed = A-Z flow
              </div>
            </div>
          )}

          {/* CONNECTED — Connected Papers style: force graph, content similarity */}
          {view === "connected" && (
            <div className="relative h-[420px] w-full overflow-hidden bg-[#fcfcf9] md:h-[560px]" style={{ zoom: zoom } as any}>
              <div className="absolute inset-0 opacity-[0.45] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, var(--border) 1px, transparent 1.3px)`, backgroundSize: "22px 22px" }} />
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/[0.04] via-transparent to-transparent pointer-events-none" />
              {/* cluster halos */}
              <svg viewBox="0 0 800 560" className="absolute inset-0 h-full w-full" aria-hidden>
                {connected.edges.map((e, idx) => {
                  const a = connected.nodes[e.a];
                  const b = connected.nodes[e.b];
                  const isActive = active === a.id || active === b.id;
                  const isBothActive = active === a.id && filtered.some((x) => x.id === b.id) && filtered.some((x) => x.id === a.id);
                  const w = Math.max(1, Math.min(3.2, 0.9 + e.w * 4));
                  const op = isActive ? 0.85 : 0.18 + e.w * 0.42;
                  return (
                    <line
                      key={`e-${idx}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={isActive ? PALETTE[connected.comp[e.a] % PALETTE.length] : "#9aa0a6"}
                      strokeWidth={w}
                      strokeOpacity={op}
                      strokeLinecap="round"
                    />
                  );
                })}
                {/* subtle cluster blobs */}
                {Array.from(new Set(connected.comp)).map((c) => {
                  const members = connected.nodes.filter((_, i) => connected.comp[i] === c);
                  if (members.length < 2) return null;
                  const mx = members.reduce((s, n) => s + n.x, 0) / members.length;
                  const my = members.reduce((s, n) => s + n.y, 0) / members.length;
                  const r = Math.sqrt(members.reduce((s, n) => s + (n.x - mx) ** 2 + (n.y - my) ** 2, 0) / members.length) + 46;
                  return <circle key={`c-${c}`} cx={mx} cy={my} r={r} fill={PALETTE[(c as number) % PALETTE.length]} opacity={0.06} stroke={PALETTE[(c as number) % PALETTE.length]} strokeOpacity={0.09} strokeDasharray="6 6" />;
                })}
              </svg>

              {connected.nodes.map((n, i) => {
                const isActive = active === n.id;
                const isDone = done.has(n.id);
                const col = PALETTE[connected.comp[i] % PALETTE.length];
                const isOrigin = n.origIdx === 0;
                const r = isOrigin ? 28 : 19 + Math.min(5, connected.edges.filter((e) => e.a === i || e.b === i).length * 1.1);
                const deg = connected.edges.filter((e) => e.a === i || e.b === i).length;
                return (
                  <div
                    key={n.id}
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center"
                    style={{ left: n.x, top: n.y }}
                  >
                    <button
                      onMouseEnter={() => setActive(n.id)}
                      onMouseLeave={() => setActive(null)}
                      onClick={() => {
                        setActive(n.id);
                        onSelect?.(n.id);
                        document.getElementById(`note-${n.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                      className={`group relative grid place-items-center rounded-full border-2 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-all hover:scale-[1.04] hover:shadow-[0_8px_20px_rgba(0,0,0,0.16)] ${isActive ? "ring-4" : ""}`}
                      style={{
                        width: r * 2,
                        height: r * 2,
                        borderColor: isActive ? col : "white",
                        boxShadow: isActive ? `0 0 0 4px ${col}22, 0 8px 20px rgba(0,0,0,0.18)` : undefined,
                        background: isOrigin ? `radial-gradient(circle at 30% 30%, white, ${col}14)` : "white",
                      }}
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-black text-white shadow" style={{ background: col }}>
                        {String.fromCharCode(65 + (n.origIdx % 26))}
                      </span>
                      {isOrigin && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#1a2e16] text-[10px] font-black text-white shadow">★</span>}
                      {isDone && <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--success)] text-white shadow">✓</span>}
                    </button>
                    <div
                      className={`pointer-events-none absolute left-1/2 top-full mt-2 w-[148px] -translate-x-1/2 rounded-xl border bg-[var(--surface)] p-2.5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all ${isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
                      style={{ borderColor: isActive ? col : "var(--border)" }}
                    >
                      <p className="line-clamp-2 text-xs font-extrabold leading-tight">{n.prompt}</p>
                      <p className="muted mt-1 line-clamp-2 text-[11px] leading-snug">{shortAnswer(n.answer, 92)}</p>
                      <p className="mt-1.5 flex items-center gap-1 text-[10px] font-bold" style={{ color: col }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: col }} /> {deg} links · {connected.comp[i] !== -1 ? `Cluster ${connected.comp[i] + 1}` : "Solo"}
                      </p>
                      {(n as any).imageUrl || (n as any).image_url ? (
                        <img src={(n as any).imageUrl || (n as any).image_url} alt={n.prompt} className="mt-2 h-16 w-full rounded-lg object-cover border border-[var(--border)]" loading="lazy" referrerPolicy="no-referrer" />
                      ) : null}
                    </div>
                    {/* static label below when not hovered (like Connected Papers) */}
                    <p className={`pointer-events-none absolute left-1/2 top-full mt-1 w-[120px] -translate-x-1/2 text-center text-[10px] font-bold leading-tight ${isActive ? "opacity-0" : "opacity-100"} muted`}>{titleTrunc(n.prompt, 22)}</p>
                  </div>
                );
              })}

              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[11px] font-bold muted shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#0ea5a0]" /> Connected Papers · thicker = more related · color = cluster · hover to inspect
              </div>
              <div className="absolute bottom-3 right-3 hidden items-center gap-1.5 rounded-full bg-[#1a2e16] px-3 py-1.5 text-xs font-bold text-white shadow lg:flex">
                {Array.from(new Set(connected.comp)).slice(0, 4).map((c, idx) => (
                  <span key={c} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: PALETTE[(c as number) % PALETTE.length] }} /> C{c as number + 1}
                  </span>
                ))}
                <span className="ml-2 opacity-70">{connected.edges.length} links</span>
              </div>
            </div>
          )}

          {/* FLOW */}
          {view === "flow" && (
            <div className="p-4 md:p-5">
              <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory" style={{ scrollbarWidth: "thin" }}>
                {/* start */}
                <div className="hidden md:flex shrink-0 snap-center flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[#2f5a22] px-5 py-6 text-white shadow">
                  <p className="text-xs font-extrabold uppercase tracking-widest opacity-90">Start</p>
                  <p className="mt-1 max-w-[14ch] text-center text-sm font-extrabold leading-tight">{title}</p>
                </div>
                {filtered.map((item, i) => {
                  const origIdx = items.findIndex((x) => x.id === item.id);
                  const col = PALETTE[origIdx % PALETTE.length];
                  const isActive = active === item.id;
                  const isDone = done.has(item.id);
                  return (
                    <div key={item.id} className="flex shrink-0 snap-center items-center gap-3">
                      <motion.div
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onMouseEnter={() => setActive(item.id)}
                        onMouseLeave={() => setActive(null)}
                        onClick={() => {
                          setActive(item.id);
                          document.getElementById(`note-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }}
                        className={`group w-[260px] cursor-pointer rounded-2xl border bg-[var(--surface)] p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5 ${isActive ? "ring-2" : ""}`}
                        style={{ borderColor: isActive ? col : "var(--border)", boxShadow: isActive ? `0 0 0 3px ${col}18` : undefined }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-black text-white" style={{ background: col }}>
                            {String.fromCharCode(65 + (origIdx % 26))}
                          </span>
                          <span className="text-xs font-extrabold" style={{ color: col }}>
                            Step {origIdx + 1}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDone(item.id);
                            }}
                            className={`ml-auto grid h-6 w-6 place-items-center rounded-full border text-xs ${isDone ? "bg-[var(--success)] border-[var(--success)] text-white" : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)]"}`}
                          >
                            <Icon icon={Tick02Icon} size={12} />
                          </button>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-extrabold leading-snug">{item.prompt}</p>
                        <p className="muted mt-1.5 line-clamp-2 text-xs leading-relaxed">{shortAnswer(item.answer, 110)}</p>
                        {(item.imageUrl || (item as any).image_url) ? (
                          <img
                            src={(item.imageUrl || (item as any).image_url) as string}
                            alt={(item.imageSearchQuery || (item as any).image_search_query || item.prompt) as string}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="mt-2 h-24 w-full rounded-xl object-cover border border-[var(--border)]"
                          />
                        ) : (item.imageSearchQuery || (item as any).image_search_query) ? (
                          <p className="mt-2 truncate text-xs italic muted">“{item.imageSearchQuery || (item as any).image_search_query}” · finding image…</p>
                        ) : null}
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs muted font-semibold">{readingTime(item.answer)} read</span>
                          <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: col }}>
                            Jump <Icon icon={ArrowRight01Icon} size={12} />
                          </span>
                        </div>
                      </motion.div>
                      {i !== filtered.length - 1 && (
                        <span className="hidden md:grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
                          <Icon icon={ArrowRight01Icon} size={14} />
                        </span>
                      )}
                    </div>
                  );
                })}
                <div className="hidden md:flex shrink-0 snap-center items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-6 text-xs font-bold muted">End · Quiz next →</div>
              </div>
              {/* mobile search */}
              <div className="mt-3 flex gap-2 md:hidden">
                <div className="relative flex-1">
                  <Icon icon={Search01Icon} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter ideas…" className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-8 pr-3 text-sm focus:border-[var(--primary)] focus:outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* GRID */}
          {view === "grid" && (
            <div className="p-4 md:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((item, i) => {
                  const origIdx = items.findIndex((x) => x.id === item.id);
                  const col = PALETTE[origIdx % PALETTE.length];
                  const isActive = active === item.id;
                  const isDone = done.has(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onMouseEnter={() => setActive(item.id)}
                      onMouseLeave={() => setActive(null)}
                      onClick={() => {
                        setActive(item.id);
                        document.getElementById(`note-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                      className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-[var(--surface)] p-4 shadow-sm hover:shadow-md transition ${isActive ? "ring-2" : ""}`}
                      style={{ borderColor: isActive ? col : "var(--border)" }}
                    >
                      <div className="absolute left-0 top-0 h-1 w-full" style={{ background: col }} />
                      <div className="flex items-start justify-between gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-xl text-sm font-black text-white shadow" style={{ background: col }}>
                          {String.fromCharCode(65 + (origIdx % 26))}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDone(item.id);
                          }}
                          className={`grid h-7 w-7 place-items-center rounded-full border text-xs ${isDone ? "bg-[var(--success)] border-[var(--success)] text-white" : "border-[var(--border)] bg-[var(--surface-2)] muted"}`}
                        >
                          <Icon icon={Tick02Icon} size={12} />
                        </button>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-extrabold leading-snug">{item.prompt}</p>
                      <p className="muted mt-1.5 line-clamp-3 text-xs leading-relaxed">{shortAnswer(item.answer, 135)}</p>
                      {(item.imageUrl || (item as any).image_url) ? (
                        <img
                          src={(item.imageUrl || (item as any).image_url) as string}
                          alt={(item.imageSearchQuery || (item as any).image_search_query || item.prompt) as string}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="mt-3 h-28 w-full rounded-xl object-cover border border-[var(--border)]"
                        />
                      ) : (item.imageSearchQuery || (item as any).image_search_query) ? (
                        <p className="mt-2 truncate text-xs italic muted">“{item.imageSearchQuery || (item as any).image_search_query}” · finding…</p>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between text-xs font-semibold muted">
                        <span>{readingTime(item.answer)}</span>
                        <span style={{ color: col }} className="inline-flex items-center gap-1">
                          Open <Icon icon={ArrowRight01Icon} size={12} />
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {filtered.length === 0 && <p className="muted py-10 text-center text-sm">No ideas match “{q}”.</p>}
            </div>
          )}

          {/* MOBILE fallback for radial */}
          <div className="md:hidden">
            {view === "radial" && (
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Icon icon={Search01Icon} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ideas…" className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm" />
                </div>
                <div className="mx-auto max-w-sm rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[#2f5a22] p-4 text-center text-white shadow">
                  <p className="text-xs font-extrabold uppercase tracking-widest opacity-90">Central Topic</p>
                  <p className="mt-1 font-extrabold leading-snug">{title}</p>
                  <p className="mt-1 text-xs opacity-80">{n} branches · A-Z</p>
                </div>
                <div className="relative pl-5">
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[var(--border)]" />
                  {filtered.map((item, i) => {
                    const origIdx = items.findIndex((x) => x.id === item.id);
                    const col = PALETTE[origIdx % PALETTE.length];
                    return (
                      <button
                        key={item.id}
                        onClick={() => document.getElementById(`note-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                        className="relative mb-3 flex w-full items-start gap-3 rounded-2xl border bg-[var(--surface)] p-3 text-left shadow-sm"
                      >
                        <span className="absolute -left-[18px] top-5 h-2.5 w-2.5 rounded-full border-2 bg-[var(--surface)]" style={{ borderColor: col }} />
                        <span className="grid h-8 w-8 place-items-center rounded-xl text-xs font-black text-white flex-shrink-0" style={{ background: col }}>
                          {String.fromCharCode(65 + (origIdx % 26))}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-extrabold leading-tight">{item.prompt}</span>
                          <span className="muted mt-1 block line-clamp-2 text-xs leading-snug">{shortAnswer(item.answer)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs">
          <span className="font-semibold muted">
            <span className="font-black text-[var(--foreground)]">{progress}/{n}</span> completed · {pct}% · <span className="hidden sm:inline">Tip: use Flow for exam order, Grid for quick skim</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const text = items.map((it, i) => `${String.fromCharCode(65 + i)}. ${it.prompt}: ${it.answer}`).join("\n\n");
                copy("all", text);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-bold hover:bg-[var(--surface-2)]"
            >
              <Icon icon={copied === "all" ? Tick02Icon : Copy01Icon} size={12} /> {copied === "all" ? "Copied!" : "Copy all"}
            </button>
            <button onClick={toggleFull} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-3 py-1.5 font-bold text-white hover:bg-[var(--primary-strong)]">
              <Icon icon={Download01Icon} size={12} /> Present
            </button>
          </div>
        </div>
      </div>

      {/* PREMIUM SHORT NOTES */}
      <div className="card overflow-hidden p-0">
        <div className="bg-gradient-to-r from-[var(--primary)]/[0.08] via-transparent to-transparent px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black tracking-tight md:text-[15px]">A-Z short notes · every idea condensed</h3>
              <p className="muted mt-1 max-w-2xl text-xs leading-relaxed md:text-[13px]">
                Full mode distills the whole document start → finish. Each note is 2–4 tight sentences — definitions, mechanism, example. Read top to bottom for the full story, or jump via the map.
              </p>
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold shadow-sm sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-[var(--success)]" /> {n} notes · ~{Math.ceil(n*0.45)} min total
            </span>
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => document.getElementById(`note-${items[i].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className={`h-7 w-7 shrink-0 rounded-full text-xs font-black ${done.has(items[i].id) ? "bg-[var(--success)] text-white" : "bg-[var(--surface)] border border-[var(--border)] muted"}`}
                style={done.has(items[i].id) ? {} : { color: PALETTE[i % PALETTE.length], borderColor: PALETTE[i % PALETTE.length] + "55" }}
              >
                {String.fromCharCode(65 + i)}
              </button>
            ))}
          </div>
        </div>

        <ol className="grid gap-3 p-4 md:p-5">
          <AnimatePresence initial={false}>
            {filtered.map((item, i) => {
              const origIdx = items.findIndex((x) => x.id === item.id);
              const col = PALETTE[origIdx % PALETTE.length];
              const isActive = active === item.id;
              const isDone = done.has(item.id);
              return (
                <motion.li
                  key={item.id}
                  id={`note-${item.id}`}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.01 }}
                  onMouseEnter={() => setActive(item.id)}
                  onMouseLeave={() => setActive(null)}
                  className={`group relative scroll-mt-5 overflow-hidden rounded-2xl border bg-[var(--surface)] p-4 transition md:p-5 ${isActive ? "shadow-md" : "hover:shadow-sm"} ${isDone ? "opacity-[0.92]" : ""}`}
                  style={{ borderColor: isActive ? col : "var(--border)", boxShadow: isActive ? `0 0 0 3px ${col}14` : undefined }}
                >
                  <div className="absolute left-0 top-0 h-full w-1" style={{ background: col }} />
                  <div className="flex gap-3 md:gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-xl text-sm font-black text-white shadow" style={{ background: `linear-gradient(135deg, ${col}, ${col}cc)` }}>
                        {String.fromCharCode(65 + (origIdx % 26))}
                      </span>
                      <span className="hidden md:block text-[10px] font-extrabold uppercase tracking-widest" style={{ color: col }}>
                        #{origIdx + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h4 className="text-sm font-extrabold leading-snug md:text-[15px]">
                          <span className="muted text-xs font-bold"> {origIdx + 1}.</span> {item.prompt}
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-[var(--surface-2)] px-2 py-1 text-[11px] font-bold muted">{readingTime(item.answer)}</span>
                          <button
                            onClick={() => toggleDone(item.id)}
                            className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-bold ${isDone ? "bg-[var(--success)] border-[var(--success)] text-white" : "border-[var(--border)] bg-[var(--surface)] muted hover:border-[var(--primary)]"}`}
                            title={isDone ? "Mark undone" : "Mark done"}
                          >
                            <Icon icon={Tick02Icon} size={14} />
                          </button>
                          <button
                            onClick={() => copy(item.id, `${item.prompt}: ${item.answer}`)}
                            className="grid h-7 w-7 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                            title="Copy"
                          >
                            <Icon icon={copied === item.id ? Tick02Icon : Copy01Icon} size={13} />
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-[14px] leading-7 md:leading-7">
                        {vocab ? <VocabularyText text={item.answer} enabled /> : item.answer}
                      </p>
                      <div className="mt-3">
                        <SectionImage
                          url={(item as any).imageUrl || (item as any).image_url}
                          query={(item as any).imageSearchQuery || (item as any).image_search_query}
                          alt={item.prompt}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-bold muted">Branch {String.fromCharCode(65 + origIdx)}</span>
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: col }}>
                          Key idea
                        </span>
                        {isDone && <span className="rounded-full bg-[var(--success)] px-2.5 py-1 text-[11px] font-bold text-white">Done ✓</span>}
                      </div>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>

        {filtered.length !== items.length && (
          <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-center text-xs font-semibold muted">
            Showing {filtered.length} of {n} — clear search to see A-Z full.
            <button onClick={() => setQ("")} className="ml-2 font-bold text-[var(--primary)] underline">Clear</button>
          </div>
        )}
      </div>
    </div>
  );
}
