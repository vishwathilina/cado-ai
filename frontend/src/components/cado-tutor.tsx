"use client";

import {
  Add01Icon,
  ArrowLeft01Icon,
  BrainIcon,
  Cancel01Icon,
  Clock01Icon,
  DashboardSquare01Icon,
  Image01Icon,
  Menu01Icon,
  Moon02Icon,
  SentIcon,
  SparklesIcon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark, CadoBuddy } from "@/components/cado-buddy";
import { Icon } from "@/components/icon";
import { pageEase } from "@/components/page-transition";
import { useTheme } from "@/components/theme-provider";
import { api, StudyItem, StudySet, TutorCitation, TutorReply } from "@/lib/api";
import { CiteViewer } from "@/components/pdf-cite";

type ChatMessage = {
  id: string;
  role: "user" | "cado";
  text: string;
  image?: TutorReply["image"];
  origin?: string;
  citations?: TutorCitation[];
  elapsed_ms?: number;
  document_url?: string | null;
  document_title?: string;
  mime_type?: string;
};

function resourceNames(citations?: TutorCitation[]) {
  const names: string[] = [];
  for (const item of citations || []) {
    if (item.kind !== "web") continue;
    const host = (item.url || "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
    const label =
      item.title.split(":")[0]?.trim() ||
      (host.includes("geeksforgeeks")
        ? "GeeksforGeeks"
        : host.includes("google.")
          ? "Google"
          : host.includes("wikipedia")
            ? "Wikipedia"
            : host.includes("programiz")
              ? "Programiz"
              : host.includes("baeldung")
                ? "Baeldung"
                : host || "web");
    if (label && !names.includes(label)) names.push(label);
  }
  names.sort((left, right) => Number(left === "Wikipedia") - Number(right === "Wikipedia"));
  return names.join(", ") || "from the web";
}

function ReplyBody({
  text,
  citations,
  onCite,
}: {
  text: string;
  citations?: TutorCitation[];
  onCite: (cite: TutorCitation) => void;
}) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p>
      {parts.map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (!match) return <span key={index}>{part}</span>;
        const number = Number(match[1]);
        const cite = citations?.find((item) => item.n === number);
        if (!cite) return <span key={index}>{part}</span>;
        return (
          <button key={index} type="button" className="tutor-ref" onClick={() => onCite(cite)}>
            {number}
          </button>
        );
      })}
    </p>
  );
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CadoTutor({
  setId,
  title,
  focusItem,
  onClose,
}: {
  setId: string;
  title?: string;
  focusItem?: StudyItem;
  onClose?: () => void;
}) {
  const thread = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [docsOpen, setDocsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sets, setSets] = useState<StudySet[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cite, setCite] = useState<{
    item: TutorCitation;
    document_url?: string | null;
    document_title?: string;
    mime_type?: string;
  } | null>(null);
  const empty = messages.length === 0;
  const lastOrigin = [...messages].reverse().find((message) => message.role === "cado")?.origin;

  const chips = useMemo(() => {
    const topic = focusItem?.prompt?.replace(/\?$/, "") || "this idea";
    return [
      { icon: SparklesIcon, label: "Why this matters", ask: `Why does ${topic} matter?` },
      { icon: BrainIcon, label: "Explain it simply", ask: `Explain ${topic} more simply` },
      { icon: Image01Icon, label: "Show a diagram", ask: `Show me a simple diagram of ${topic}` },
    ];
  }, [focusItem]);

  const groups = useMemo(() => {
    const buckets = new Map<string, StudySet[]>();
    for (const set of sets) {
      const label = dayLabel(set.created_at);
      buckets.set(label, [...(buckets.get(label) ?? []), set]);
    }
    return [...buckets.entries()];
  }, [sets]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    field.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api<StudySet[]>("/study-sets")
      .then((payload) => {
        if (active) setSets(payload);
      })
      .catch(() => {
        if (active) setSets([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!messages.length && !busy) return;
    const node = thread.current;
    if (!node) return;
    const move = () => {
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    };
    const frame = requestAnimationFrame(move);
    const later = window.setTimeout(move, 120);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(later);
    };
  }, [busy, messages]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (cite) setCite(null);
      else if (docsOpen) setDocsOpen(false);
      else onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cite, docsOpen, onClose]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || busy) return;
    setError("");
    setBusy(true);
    setQuestion("");
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: trimmed };
    setMessages((current) => [...current, userMessage]);
    try {
      const payload = await api<TutorReply>(`/study-sets/${setId}/tutor`, {
        method: "POST",
        body: JSON.stringify({
          question: trimmed,
          item_id: focusItem?.id ?? null,
        }),
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "cado",
          text: payload.reply,
          image: payload.image,
          origin: payload.origin,
          citations: payload.citations,
          elapsed_ms: payload.elapsed_ms,
          document_url: payload.document_url,
          document_title: payload.document_title,
          mime_type: payload.mime_type,
        },
      ]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Cado could not answer that");
    } finally {
      setBusy(false);
      field.current?.focus();
    }
  }

  function openCite(item: TutorCitation, message?: ChatMessage) {
    if (item.kind === "web" && item.url) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    setCite({
      item,
      document_url: message?.document_url,
      document_title: message?.document_title,
      mime_type: message?.mime_type,
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  const sidebar = (
    <aside className="tutor-side">
      <div className="tutor-side-head">
        <Link href="/dashboard" className="tutor-side-brand" aria-label="Cado AI">
          <BrandMark compact />
          <span>Cado</span>
        </Link>
        <button type="button" className="tutor-collapse" onClick={() => setCollapsed(true)} aria-label="Hide notes list">
          <Icon icon={ArrowLeft01Icon} size={18} />
        </button>
        <button type="button" className="tutor-side-close" onClick={() => setDocsOpen(false)} aria-label="Close notes list">
          <Icon icon={Cancel01Icon} size={18} />
        </button>
      </div>

      <Link href="/upload" className="tutor-new">
        <Icon icon={Add01Icon} size={16} /> New notes
      </Link>

      <nav className="tutor-side-nav">
        <Link href="/dashboard" className="tutor-side-link">
          <Icon icon={DashboardSquare01Icon} size={16} /> Today
        </Link>
        <Link href="/history" className="tutor-side-link">
          <Icon icon={Clock01Icon} size={16} /> History
        </Link>
      </nav>

      <p className="tutor-side-kicker">Notes {sets.length ? `(${sets.length})` : ""}</p>
      <div className="tutor-side-list">
        {groups.map(([label, rows]) => (
          <div key={label}>
            <p className="tutor-side-kicker">{label}</p>
            {rows.map((set) => (
              <Link
                key={set.id}
                href={`/learn/${set.id}?ask=1`}
                className={`tutor-doc ${set.id === setId ? "is-active" : ""}`}
                onClick={() => setDocsOpen(false)}
              >
                {set.title}
              </Link>
            ))}
          </div>
        ))}
        {!sets.length && <p className="tutor-side-empty">{title || "Current notes"}</p>}
      </div>

      <div className="tutor-side-foot">
        <button type="button" className="tutor-side-link" onClick={onClose}>
          <Icon icon={ArrowLeft01Icon} size={16} /> Back to notes
        </button>
        <button
          type="button"
          className="tutor-side-link"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Icon icon={Sun03Icon} size={16} /> : <Icon icon={Moon02Icon} size={16} />}
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </aside>
  );

  return (
    <section className={`tutor-stage ${collapsed ? "is-collapsed" : ""} ${lastOrigin === "web" ? "is-web" : lastOrigin === "notes" ? "is-notes" : ""}`}>
      {docsOpen && (
        <button type="button" className="tutor-side-scrim" aria-label="Close notes list" onClick={() => setDocsOpen(false)} />
      )}
      <div className={`tutor-side-wrap ${docsOpen ? "is-open" : ""}`}>{sidebar}</div>

      <div className="tutor-workspace">
        <header className="tutor-top">
          <button type="button" className="tutor-docs-toggle" onClick={() => { setCollapsed(false); setDocsOpen(true); }}>
            <Icon icon={Menu01Icon} size={18} /> Notes
          </button>
          <p className="tutor-top-name">Ask Cado</p>
          <button type="button" className="tutor-back" onClick={onClose}>
            Close
          </button>
        </header>

        <div ref={thread} className={`tutor-thread ${empty ? "is-empty" : ""}`}>
          <div className="tutor-col">
          {empty ? (
            <div className="tutor-hero">
              <CadoBuddy size={150} message="" className="mx-auto" />
              <p className="tutor-kicker">Ask Cado</p>
              <h1 className="tutor-headline">Built to study.<br />Happy to explain.</h1>
              <p className="tutor-lede">
                Answering from <em>{title || "your notes"}</em>
              </p>
              <div className="tutor-chips">
                {chips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    className="tutor-chip"
                    disabled={busy}
                    onClick={() => void ask(chip.ask)}
                  >
                    <Icon icon={chip.icon} size={15} /> {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="tutor-feed">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`tutor-row ${message.role === "user" ? "is-user" : ""} ${message.origin === "web" ? "is-web" : ""}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: pageEase }}
                >
                  {message.role === "cado" && (
                    <span className="tutor-avatar" aria-hidden>
                      <img src="/cado-hiker.webp" alt="" className="tutor-avatar-light" />
                      <img src="/cado-astronaut.webp" alt="" className="tutor-avatar-dark" />
                    </span>
                  )}
                  <div className={`tutor-bubble ${message.origin === "web" ? "is-web" : message.origin === "notes" ? "is-notes" : ""}`}>
                    {message.role === "cado" && message.origin === "web" && (
                      <p className="tutor-origin">Not in your notes · {resourceNames(message.citations)}</p>
                    )}
                    {message.role === "cado" && message.origin === "notes" && (
                      <p className="tutor-origin is-notes">From your notes</p>
                    )}
                    {message.role === "cado" ? (
                      <ReplyBody
                        text={message.text}
                        citations={message.citations}
                        onCite={(item) => openCite(item, message)}
                      />
                    ) : (
                      <p>{message.text}</p>
                    )}
                    {message.role === "cado" && Boolean(message.citations?.length) && (
                      <div className="tutor-cites">
                        {message.citations?.map((item) => (
                          <button
                            key={`${item.kind}-${item.n}`}
                            type="button"
                            className="tutor-cite-chip"
                            onClick={() => openCite(item, message)}
                          >
                            [{item.n}] {item.title}
                          </button>
                        ))}
                      </div>
                    )}
                    {message.image && (
                      <figure className="tutor-figure">
                        <img
                          src={message.image.url}
                          alt={message.image.caption}
                          referrerPolicy="no-referrer"
                        />
                        <figcaption className="muted mt-2 text-xs leading-5">
                          {message.image.caption}
                          {message.image.credit ? ` · ${message.image.credit}` : ""}
                        </figcaption>
                      </figure>
                    )}
                    {message.role === "cado" && (
                      <p className="tutor-meta">
                        {message.elapsed_ms
                          ? message.elapsed_ms >= 1000
                            ? `${(message.elapsed_ms / 1000).toFixed(1)}s`
                            : `${message.elapsed_ms}ms`
                          : ""}
                        {message.citations?.length ? ` · ${message.citations.length} source${message.citations.length === 1 ? "" : "s"}` : ""}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            </div>
          )}
          {busy && (
            <div className="tutor-row tutor-thinking" aria-live="polite">
              <img src="/cadoreaction/jumping.gif" alt="" className="tutor-think-gif" />
              <p className="tutor-status">Thinking…</p>
            </div>
          )}
          <div ref={bottom} className="tutor-bottom" />
          </div>
        </div>

        <div className="tutor-dock">
          <div className="tutor-col">
          {error && <p className="mb-2 text-center text-sm text-[var(--danger)]">{error}</p>}
          <form onSubmit={submit} className="tutor-composer">
            <input
              ref={field}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={`Ask about ${title || "these notes"}…`}
              minLength={3}
              disabled={busy}
            />
            <button
              disabled={busy || question.trim().length < 3}
              className="tutor-send"
              type="submit"
              aria-label="Ask Cado"
            >
              <Icon icon={SentIcon} size={18} />
            </button>
          </form>
          <p className="tutor-note">Tap a number like [1] to open the page it came from. Web answers turn amber so you can tell they are not from your notes.</p>
          </div>
        </div>
      </div>
      {cite && (
        <CiteViewer
          cite={cite.item}
          documentUrl={cite.document_url || null}
          documentTitle={cite.document_title}
          mimeType={cite.mime_type}
          onClose={() => setCite(null)}
        />
      )}
    </section>
  );
}
