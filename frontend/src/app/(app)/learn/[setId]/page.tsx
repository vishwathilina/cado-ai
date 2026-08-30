"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BrainIcon,
  Chat01Icon,
  Refresh01Icon,
  TranslateIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { FadeIn, pageEase } from "@/components/page-transition";
import { CadoTutor } from "@/components/cado-tutor";
import { MindMap } from "@/components/mind-map";
import { SectionImage } from "@/components/section-image";
import { VocabularyText } from "@/components/vocabulary-text";
import { api, StudyItem, StudySet } from "@/lib/api";

export default function LearnPage() {
  const { setId } = useParams<{ setId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [vocabulary, setVocabulary] = useState(false);
  const [tab, setTab] = useState<"explanation" | "flashcard" | "tutor">(
    searchParams.get("ask") === "1" ? "tutor" : "explanation",
  );
  const [error, setError] = useState("");
  const [fullById, setFullById] = useState<Record<string, string>>({});
  const [fullLoading, setFullLoading] = useState<string | null>(null);
  const [fullError, setFullError] = useState("");

  useEffect(() => {
    api<StudySet>(`/study-sets/${setId}`)
      .then((set) => {
        setStudySet(set);
        if (searchParams.get("ask") === "1") setTab("tutor");
        else if (!set.items.some((item) => item.kind === "explanation")) setTab("flashcard");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load set"));
  }, [searchParams, setId]);

  const explanations = useMemo(() => studySet?.items.filter((item) => item.kind === "explanation") ?? [], [studySet]);
  const cards = useMemo(() => studySet?.items.filter((item) => item.kind === "flashcard") ?? [], [studySet]);
  const hasQuiz = studySet?.items.some((item) => item.kind === "mcq") ?? false;
  const isFullAZ = useMemo(() => {
    if (!explanations.length) return false;
    // Full mode stores full_explanation = answer (short notes A-Z)
    return explanations.some((e) => e.full_explanation !== null && e.full_explanation !== undefined);
  }, [explanations]);
  const mindItems = useMemo(
    () =>
      explanations.map((e) => ({
        id: e.id,
        prompt: e.prompt,
        answer: fullById[e.id] || e.full_explanation || e.answer,
        imageSearchQuery: (e as any).imageSearchQuery || (e as any).image_search_query,
        imageUrl: (e as any).imageUrl || (e as any).image_url,
      })),
    [explanations, fullById],
  );

  // Poll for context images: Google fetch runs in background with 2 workers, 350ms stagger
  const pendingImages = useMemo(
    () => explanations.filter((e) => ((e as any).imageSearchQuery || (e as any).image_search_query) && !((e as any).imageUrl || (e as any).image_url)).length,
    [explanations],
  );

  useEffect(() => {
    if (!studySet || pendingImages === 0) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const fresh = await api<StudySet>(`/study-sets/${setId}`);
        if (!alive) return;
        setStudySet(fresh);
        const still = fresh.items.filter((it: any) => it.kind === "explanation" && (it.imageSearchQuery || it.image_search_query) && !(it.imageUrl || it.image_url)).length;
        if (still > 0) t = setTimeout(tick, 2500);
      } catch {}
    };
    t = setTimeout(tick, 2200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [studySet, pendingImages, setId]);

  useEffect(() => {
    if (searchParams.get("ask") === "1") setTab("tutor");
  }, [searchParams, setId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (tab !== "flashcard") return;
      if (event.key === " " || event.key === "Enter") {
        if ((event.target as HTMLElement | null)?.tagName === "BUTTON") return;
        event.preventDefault();
        setFlipped((current) => !current);
      }
      if (event.key === "ArrowRight") {
        setFlipped(false);
        setFlashIndex((current) => Math.min(current + 1, Math.max(cards.length - 1, 0)));
      }
      if (event.key === "ArrowLeft") {
        setFlipped(false);
        setFlashIndex((current) => Math.max(current - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cards.length, tab]);

  async function review(confidence: number) {
    const card = cards[flashIndex];
    if (!card) return;
    try {
      await api(`/flashcards/${card.id}/review`, { method: "PUT", body: JSON.stringify({ confidence }) });
      setFlipped(false);
      setFlashIndex((current) => Math.min(current + 1, cards.length - 1));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this review");
    }
  }

  async function expandExplanation(item: StudyItem) {
    if (item.full_explanation || fullById[item.id]) return;
    setFullLoading(item.id);
    setFullError("");
    try {
      const payload = await api<{ explanation: string }>(`/study-items/${item.id}/full-explain`, { method: "POST" });
      setFullById((current) => ({ ...current, [item.id]: payload.explanation }));
    } catch (reason) {
      setFullError(reason instanceof Error ? reason.message : "Could not load a full explanation");
    } finally {
      setFullLoading(null);
    }
  }

  if (error) return <div className="card p-6 text-[var(--danger)]">{error}</div>;
  if (!studySet) return <div className="soft h-96 animate-pulse rounded-3xl" />;
  const card: StudyItem | undefined = cards[flashIndex];

  if (tab === "tutor") {
    return (
      <CadoTutor
        setId={setId}
        title={studySet.title}
        focusItem={explanations[0] ?? cards[0]}
        onClose={() => {
          setTab(explanations.length ? "explanation" : "flashcard");
          router.replace(`/learn/${setId}`, { scroll: false });
        }}
      />
    );
  }

  return (
    <div className="learn">
      <header className="learn-hero">
        <div className="learn-nav">
          <Link href="/dashboard" className="learn-back">
            <Icon icon={ArrowLeft01Icon} size={16} /> Today
            <span>Learn</span>
          </Link>
          {hasQuiz && (
            <Link href={`/quiz/${setId}`} className="learn-cta">
              Take quiz <Icon icon={ArrowRight01Icon} size={16} />
            </Link>
          )}
        </div>
        <h1>{studySet.title}</h1>
        <div className="learn-modes">
          <div className="learn-modes-tabs" role="tablist" aria-label="Study mode">
            {!!explanations.length && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "explanation"}
                className={tab === "explanation" ? "is-on" : ""}
                onClick={() => setTab("explanation")}
              >
                <Icon icon={BrainIcon} size={15} /> Explanations
              </button>
            )}
            {!!cards.length && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "flashcard"}
                className={tab === "flashcard" ? "is-on" : ""}
                onClick={() => setTab("flashcard")}
              >
                Flashcards
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={false}
              onClick={() => {
                setTab("tutor");
                router.replace(`/learn/${setId}?ask=1`, { scroll: false });
              }}
            >
              <Icon icon={Chat01Icon} size={15} /> Ask Cado
            </button>
          </div>
          <button
            type="button"
            onClick={() => setVocabulary(!vocabulary)}
            className={`learn-vocab ${vocabulary ? "is-on" : ""}`}
            aria-pressed={vocabulary}
          >
            <Icon icon={TranslateIcon} size={16} /> Vocabulary
          </button>
        </div>
      </header>

      {tab === "explanation" && (
        <section className={isFullAZ ? "space-y-0" : "space-y-4"}>
          {isFullAZ ? (
            <div className="mx-auto max-w-[800px]">
              {/* Clean doc header */}
              <div className="mb-3 text-xs muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Last sync: Just now
                  {pendingImages > 0 && <span className="ml-2 hidden sm:inline animate-pulse">· Finding images ({explanations.length - pendingImages}/{explanations.length})</span>}
                  {pendingImages === 0 && explanations.some((e: any) => e.imageUrl || e.image_url) && <span className="ml-2 hidden sm:inline text-emerald-600">· Images ready</span>}
                </span>
              </div>

              <article className="doc-helvetica overflow-hidden rounded-xl bg-[var(--surface)] shadow-sm">
                {/* Title block */}
                <div className="px-7 pb-3 pt-8 md:px-10 md:pt-10">
                  <h1 className="text-3xl font-extrabold leading-[1.15] tracking-tight md:text-[36px]">{studySet.title}</h1>
                </div>

                {/* Intro paragraph — use first sentence of doc if available, else generic */}
                <div className="px-7 md:px-10">
                  <p className="border-b border-[var(--border)] pb-7 text-[16px] leading-8 muted md:text-[17px] md:leading-[1.9]">
                    During the final design review, the team evaluated the condensed notes for <span className="font-bold text-[var(--foreground)]">{studySet.title}</span>. The content below covers {explanations.length} key ideas in logical order, each with a concise 2–4 sentence note and a context image matched via Google Images. Skim top to bottom for the full story.
                  </p>
                </div>

                {/* Sections — clean, spacious, Helvetica */}
                <div className="divide-y divide-[var(--border)]">
                  {explanations.map((item, idx) => {
                    const text = fullById[item.id] || (item as any).full_explanation || item.answer;
                    const imgUrl = (item as any).imageUrl || (item as any).image_url;
                    const imgQuery = (item as any).imageSearchQuery || (item as any).image_search_query;
                    return (
                      <section key={item.id} id={`sec-${item.id}`} className="px-7 py-8 md:px-10 md:py-9">
                        <h2 className="text-[19px] font-extrabold leading-snug tracking-tight md:text-[21px]">
                          <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-black ring-1 ring-[var(--border)]">{idx + 1}</span>
                          {item.prompt}
                        </h2>
                        <div className="prose max-w-none pt-4 text-[16px] leading-8 md:text-[17px] md:leading-[1.85]">
                          <p className="text-[16px] leading-8 md:text-[17px] md:leading-[1.85]">
                            <VocabularyText text={text} enabled={vocabulary} />
                          </p>
                        </div>

                        {/* Image — clean, big, centered */}
                        <div className="mt-7 flex justify-center">
                          <figure className="w-full max-w-[640px]">
                            {imgUrl ? (
                              <>
                                <img
                                  src={imgUrl}
                                  alt={imgQuery || item.prompt}
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  className="w-full rounded-xl bg-[var(--surface-2)] object-contain shadow-sm"
                                  style={{ maxHeight: 460 }}
                                />
                                <figcaption className="mt-3 text-center text-[13px] leading-relaxed muted">
                                  <span className="font-semibold text-[var(--foreground)]">{item.prompt}</span> · “{imgQuery}” · via Google Images
                                </figcaption>
                              </>
                            ) : imgQuery ? (
                              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
                                <p className="text-center text-sm font-semibold muted">Finding image for “{imgQuery}”</p>
                                <div className="mx-auto mt-4 h-32 w-full max-w-[360px] animate-pulse rounded-xl bg-[var(--border)]/40" />
                                <p className="mt-3 text-center text-xs muted">Searching Google Images like a browser… 2 workers · 350ms stagger</p>
                              </div>
                            ) : null}
                          </figure>
                        </div>
                      </section>
                    );
                  })}
                </div>

                {/* Foot actions — minimal */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-6 py-4 text-xs dark:border-[#2a2a2a] dark:bg-[#1a1a1a]/60 md:px-8">
                  <span className="font-semibold muted">{explanations.length} sections · A-Z · clean doc</span>
                  <div className="flex gap-2">
                    <Link href={`/quiz/${setId}`} className="rounded-full bg-[var(--primary)] px-4 py-1.5 text-xs font-bold text-white hover:bg-[var(--primary-strong)]">Take quiz →</Link>
                    <button onClick={() => setVocabulary((v) => !v)} className={`rounded-full border px-4 py-1.5 text-xs font-bold ${vocabulary ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)]"}`}>Vocabulary {vocabulary ? "ON" : "OFF"}</button>
                  </div>
                </div>
              </article>

              {/* Optional: subtle mind-map link — not dominant */}
              <details className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
                <summary className="cursor-pointer list-none text-sm font-bold">Show mind map (Connected Papers style) — optional</summary>
                <div className="pt-3">
                  <MindMap title={studySet.title} items={mindItems} vocab={vocabulary} />
                </div>
              </details>
            </div>
          ) : (
            <>
              {explanations.map((item, index) => (
                <FadeIn key={item.id} delay={index * 0.05}>
                  <article className="card overflow-hidden p-0">
                    <div className="p-6 md:p-8">
                      <p className="kicker mb-3">Concept {index + 1}</p>
                      <h3 className="text-xl font-extrabold">{item.prompt}</h3>
                      <p className="mt-4 text-[1.05rem] leading-8">
                        <VocabularyText text={fullById[item.id] || item.full_explanation || item.answer} enabled={vocabulary} />
                      </p>
                    </div>
                    <div className="px-6 pb-6 md:px-8">
                      <SectionImage
                        url={(item as any).imageUrl || (item as any).image_url}
                        query={(item as any).imageSearchQuery || (item as any).image_search_query}
                        alt={item.prompt}
                      />
                    </div>
                    {!item.full_explanation && !fullById[item.id] && (
                      <button
                        type="button"
                        className="btn-secondary mt-4 py-2 text-sm"
                        disabled={fullLoading === item.id}
                        onClick={() => void expandExplanation(item)}
                      >
                        {fullLoading === item.id ? "Writing…" : "Full explain"}
                      </button>
                    )}
                    {fullError && fullLoading === null && (
                      <p className="mt-2 text-sm text-[var(--danger)]">{fullError}</p>
                    )}
                  </article>
                </FadeIn>
              ))}
            </>
          )}
          {!!cards.length && (
            <button onClick={() => setTab("flashcard")} className="btn-primary">
              Next: flashcards <Icon icon={ArrowRight01Icon} size={16} />
            </button>
          )}
        </section>
      )}

      {tab === "flashcard" && card && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <p className="muted text-sm">Click the card or press space to flip. Rate how well you knew it.</p>
            <p className="text-sm font-bold">{flashIndex + 1} / {cards.length}</p>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: pageEase }}
            >
          <button onClick={() => setFlipped(!flipped)} className="block h-72 w-full [perspective:1000px]">
            <motion.div className="relative size-full [transform-style:preserve-3d]" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: "spring", stiffness: 150, damping: 20 }}>
              <div className="card absolute inset-0 grid place-items-center p-8 [backface-visibility:hidden]">
                <div>
                  <p className="kicker mb-5">Front</p>
                  <p className="text-2xl font-black">{card.prompt}</p>
                  <Icon icon={Refresh01Icon} className="muted mx-auto mt-8" size={18} />
                </div>
              </div>
              <div className="card absolute inset-0 grid place-items-center bg-[var(--surface-2)] p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div>
                  <p className="kicker mb-5">Back</p>
                  <p className="text-xl font-bold leading-8"><VocabularyText text={card.answer} enabled={vocabulary} /></p>
                </div>
              </div>
            </motion.div>
          </button>
            </motion.div>
          </AnimatePresence>
          <AnimatePresence>
            {flipped && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex justify-center gap-3">
                {[[1, "Again"], [2, "Learning"], [3, "Got it"]].map(([value, label]) => (
                  <button key={label} onClick={() => review(value as number)} className="btn-secondary">{label}</button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {hasQuiz && flashIndex === cards.length - 1 && flipped && (
            <div className="mt-6 text-center">
              <Link href={`/quiz/${setId}`} className="btn-primary">I’m ready for the quiz <Icon icon={ArrowRight01Icon} size={16} /></Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
