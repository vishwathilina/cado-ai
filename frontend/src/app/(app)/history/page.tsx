"use client";

import {
  Add01Icon,
  Clock01Icon,
  File01Icon,
  HelpCircleIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CadoBuddy } from "@/components/cado-buddy";
import { Icon } from "@/components/icon";
import { FadeIn } from "@/components/page-transition";
import { EmptyState, PageHeader } from "@/components/ui";
import { api, StudySet } from "@/lib/api";

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function counts(set: StudySet) {
  return {
    explanations: set.explanation_count ?? set.items.filter((item) => item.kind === "explanation").length,
    flashcards: set.flashcard_count ?? set.items.filter((item) => item.kind === "flashcard").length,
    questions: set.mcq_count ?? set.items.filter((item) => item.kind === "mcq").length,
  };
}

export default function HistoryPage() {
  const [sets, setSets] = useState<StudySet[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<StudySet[]>("/study-sets")
      .then((payload) => {
        if (active) setSets(payload);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load history");
      });
    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(() => {
    const buckets = new Map<string, StudySet[]>();
    for (const set of sets ?? []) {
      const label = dayLabel(set.created_at);
      buckets.set(label, [...(buckets.get(label) ?? []), set]);
    }
    return [...buckets.entries()];
  }, [sets]);

  if (error) return <div className="card p-6 text-[var(--danger)]">{error}</div>;
  if (!sets) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="soft h-24 rounded-3xl" />
        <div className="soft h-40 rounded-3xl" />
        <div className="soft h-40 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        kicker="Trail log"
        title="Everything you generated."
        subtitle="Reopen any set Cado made from your notes. Learn, quiz, or pick up where you left off."
        action={
          <Link href="/upload" className="btn-primary">
            <Icon icon={Add01Icon} size={18} /> New set
          </Link>
        }
      />

      {!sets.length ? (
        <section className="card grid gap-6 p-6 md:grid-cols-[1fr_140px] md:items-center">
          <EmptyState
            title="No generated sets yet."
            copy="Upload a PDF or photo and Cado will keep it here so you can come back later."
            href="/upload"
            cta="Generate your first set"
          />
          <CadoBuddy size={140} message="I’ll keep the trail marked." />
        </section>
      ) : (
        groups.map(([label, items]) => (
          <section key={label} className="space-y-3">
            <p className="kicker">{label}</p>
            <div className="grid gap-4 md:grid-cols-2">
            {items.map((set, index) => {
              const tally = counts(set);
              return (
                <FadeIn key={set.id} delay={index * 0.05} className="h-full">
                <article className="card flex h-full flex-col p-5">
                  <p className="font-display text-lg font-semibold">{set.title}</p>
                  <p className="muted mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1">
                      <Icon icon={Clock01Icon} size={14} />
                      {new Date(set.created_at).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>· {set.language}</span>
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {tally.explanations > 0 && (
                      <li className="soft inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
                        <Icon icon={File01Icon} size={13} /> {tally.explanations} explanations
                      </li>
                    )}
                    {tally.flashcards > 0 && (
                      <li className="soft inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
                        <Icon icon={SparklesIcon} size={13} /> {tally.flashcards} flashcards
                      </li>
                    )}
                    {tally.questions > 0 && (
                      <li className="soft inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
                        <Icon icon={HelpCircleIcon} size={13} /> {tally.questions} quiz questions
                      </li>
                    )}
                  </ul>
                  <div className="mt-auto flex gap-2 pt-4">
                    {(tally.explanations > 0 || tally.flashcards > 0) && (
                      <Link href={`/learn/${set.id}`} className="btn-secondary flex-1 py-2 text-sm">
                        Learn
                      </Link>
                    )}
                    {tally.questions > 0 && (
                      <Link href={`/quiz/${set.id}`} className="btn-primary flex-1 py-2 text-sm">
                        Quiz
                      </Link>
                    )}
                  </div>
                </article>
                </FadeIn>
              );
            })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
