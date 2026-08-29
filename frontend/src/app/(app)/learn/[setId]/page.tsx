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
  const [mindView, setMindView] = useState<"list" | "map">("map");

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
      })),
    [explanations, fullById],
  );

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
        <section className="space-y-4">
          {isFullAZ ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] p-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setMindView("map")}
                    className={`rounded-lg px-4 py-2 text-sm font-bold ${mindView === "map" ? "bg-[var(--surface)] shadow text-[var(--foreground)]" : "text-[var(--muted)]"}`}
                  >
                    Mind Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setMindView("list")}
                    className={`rounded-lg px-4 py-2 text-sm font-bold ${mindView === "list" ? "bg-[var(--surface)] shadow text-[var(--foreground)]" : "text-[var(--muted)]"}`}
                  >
                    Short Notes List
                  </button>
                </div>
                <p className="hidden sm:block text-xs font-semibold muted px-2">Full · A-Z · {explanations.length} notes</p>
              </div>

              {mindView === "map" ? (
                <MindMap title={studySet.title} items={mindItems} />
              ) : (
                <div className="space-y-4">
                  {explanations.map((item, index) => (
                    <FadeIn key={item.id} delay={index * 0.03}>
                      <article className="card p-6 md:p-7">
                        <p className="kicker mb-2">
                          {String.fromCharCode(65 + (index % 26))} · Note {index + 1} / {explanations.length}
                        </p>
                        <h3 className="text-lg font-extrabold leading-snug">{item.prompt}</h3>
                        <p className="mt-3 text-[1.02rem] leading-7">
                          <VocabularyText text={fullById[item.id] || item.full_explanation || item.answer} enabled={vocabulary} />
                        </p>
                      </article>
                    </FadeIn>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {explanations.map((item, index) => (
                <FadeIn key={item.id} delay={index * 0.05}>
                  <article className="card p-6 md:p-8">
                    <p className="kicker mb-3">Concept {index + 1}</p>
                    <h3 className="text-xl font-extrabold">{item.prompt}</h3>
                    <p className="mt-4 text-[1.05rem] leading-8">
                      <VocabularyText text={fullById[item.id] || item.full_explanation || item.answer} enabled={vocabulary} />
                    </p>
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
