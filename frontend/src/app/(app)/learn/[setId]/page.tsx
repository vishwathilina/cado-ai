"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BrainIcon,
  Refresh01Icon,
  TranslateIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { PageHeader, Steps } from "@/components/ui";
import { VocabularyText } from "@/components/vocabulary-text";
import { api, StudyItem, StudySet } from "@/lib/api";

export default function LearnPage() {
  const { setId } = useParams<{ setId: string }>();
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [vocabulary, setVocabulary] = useState(false);
  const [tab, setTab] = useState<"explanation" | "flashcard">("explanation");
  const [error, setError] = useState("");

  useEffect(() => {
    api<StudySet>(`/study-sets/${setId}`)
      .then((set) => {
        setStudySet(set);
        if (!set.items.some((item) => item.kind === "explanation")) setTab("flashcard");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load set"));
  }, [setId]);

  const explanations = useMemo(() => studySet?.items.filter((item) => item.kind === "explanation") ?? [], [studySet]);
  const cards = useMemo(() => studySet?.items.filter((item) => item.kind === "flashcard") ?? [], [studySet]);
  const hasQuiz = studySet?.items.some((item) => item.kind === "mcq") ?? false;

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
    await api(`/flashcards/${card.id}/review`, { method: "PUT", body: JSON.stringify({ confidence }) });
    setFlipped(false);
    setFlashIndex((current) => Math.min(current + 1, cards.length - 1));
  }

  if (error) return <div className="card p-6 text-[var(--danger)]">{error}</div>;
  if (!studySet) return <div className="soft h-96 animate-pulse rounded-3xl" />;
  const card: StudyItem | undefined = cards[flashIndex];

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <Link href="/dashboard" className="muted inline-flex items-center gap-1 text-sm font-bold">
        <Icon icon={ArrowLeft01Icon} size={16} /> Today
      </Link>
      <PageHeader
        kicker="Learn"
        title={studySet.title}
        subtitle="Read the short explanations, flip the cards, then take the quiz."
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setVocabulary(!vocabulary)} className={`btn-secondary py-2 text-sm ${vocabulary ? "!bg-[var(--primary)] !text-white" : ""}`}>
              <Icon icon={TranslateIcon} size={16} /> Vocabulary
            </button>
            {hasQuiz && <Link href={`/quiz/${setId}`} className="btn-primary py-2 text-sm">Take quiz <Icon icon={ArrowRight01Icon} size={16} /></Link>}
          </div>
        }
      />
      <Steps current={tab === "explanation" ? 1 : 2} items={["Upload", "Learn", "Quiz"]} />

      <div className="flex gap-2">
        {!!explanations.length && (
          <button onClick={() => setTab("explanation")} className={`btn-secondary py-2 text-sm ${tab === "explanation" ? "!bg-[var(--primary)] !text-white" : ""}`}>
            <Icon icon={BrainIcon} size={15} /> Explanations
          </button>
        )}
        {!!cards.length && (
          <button onClick={() => setTab("flashcard")} className={`btn-secondary py-2 text-sm ${tab === "flashcard" ? "!bg-[var(--primary)] !text-white" : ""}`}>
            Flashcards {cards.length}
          </button>
        )}
      </div>

      {tab === "explanation" && (
        <section className="space-y-4">
          {explanations.map((item, index) => (
            <article key={item.id} className="card p-6 md:p-8">
              <p className="kicker mb-3">Concept {index + 1}</p>
              <h3 className="text-xl font-extrabold">{item.prompt}</h3>
              <p className="mt-4 text-[1.05rem] leading-8"><VocabularyText text={item.answer} enabled={vocabulary} /></p>
            </article>
          ))}
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
