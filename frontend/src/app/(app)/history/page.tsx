"use client";

import { Add01Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EditorialAppPage, EditorialHero } from "@/components/editorial/editorial-app-page";
import { FadeIn, FadeLoading, FadeLoadingGroup } from "@/components/page-transition";
import { Icon } from "@/components/icon";
import { useMotionSmoothScroll } from "@/hooks/use-motion-smooth-scroll";
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
  useMotionSmoothScroll();
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

  if (error) {
    return (
      <EditorialAppPage>
        <div className="editorial-card p-6 text-red-700">{error}</div>
      </EditorialAppPage>
    );
  }

  if (!sets) {
    return (
      <EditorialAppPage>
        <FadeLoadingGroup className="space-y-5">
          <FadeLoading className="editorial-card h-28" />
          <FadeLoading className="editorial-card h-40" />
          <FadeLoading className="editorial-card h-40" />
        </FadeLoadingGroup>
      </EditorialAppPage>
    );
  }

  return (
    <EditorialAppPage>
      <EditorialHero
        kicker="Trail log"
        title="Everything you generated."
        subtitle="Reopen any set Cado made from your notes. Learn, quiz, or pick up where you left off."
        action={
          <Link href="/upload" className="editorial-btn-primary">
            <Icon icon={Add01Icon} size={16} />
            New set
          </Link>
        }
      />

      {!sets.length ? (
        <section className="editorial-card editorial-scene-band overflow-hidden">
          <div className="relative aspect-[21/9] min-h-[14rem]">
            <Image
              src="/pixel-meadow.jpg"
              alt="Pixel art meadow with poppies and wildflowers"
              fill
              className="object-cover"
              sizes="(min-width: 768px) 72rem, 100vw"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--background)_35%,transparent)] px-6">
              <div className="editorial-empty-panel max-w-md p-8 text-center">
                <p className="editorial-title text-3xl">No sets yet</p>
                <p className="mt-3 text-sm leading-relaxed editorial-muted">
                  Upload a PDF or photo and Cado will keep it here so you can come back later.
                </p>
                <Link href="/upload" className="editorial-btn-primary mt-6">
                  Generate your first set
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="space-y-10">
          {groups.map(([label, items]) => (
            <section key={label}>
              <div className="editorial-day-label mb-4">
                <span>{label}</span>
                <span className="editorial-chip ml-auto shrink-0">{items.length}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((set, index) => {
                  const tally = counts(set);
                  const total = tally.explanations + tally.flashcards + tally.questions;
                  return (
                    <FadeIn key={set.id} delay={index * 0.04} className="h-full">
                      <article className="editorial-card editorial-set-card group">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight">{set.title}</h3>
                          <span className="hidden h-7 w-7 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] text-[var(--muted)] group-hover:bg-[var(--foreground)] group-hover:text-[var(--background)] md:grid">
                            <Icon icon={Clock01Icon} size={14} />
                          </span>
                        </div>
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] editorial-muted">
                          <span className="editorial-chip">
                            <Icon icon={Clock01Icon} size={12} />
                            {new Date(set.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </span>
                          <span className="text-xs">
                            {set.language} · {total} items
                          </span>
                        </p>
                        <ul className="mt-5 flex flex-wrap gap-2">
                          {tally.explanations > 0 && (
                            <li className="editorial-chip">
                              <span className="size-1.5 rounded-full bg-emerald-600" /> {tally.explanations} notes
                            </li>
                          )}
                          {tally.flashcards > 0 && (
                            <li className="editorial-chip">
                              <span className="size-1.5 rounded-full bg-amber-500" /> {tally.flashcards} cards
                            </li>
                          )}
                          {tally.questions > 0 && (
                            <li className="editorial-chip">
                              <span className="size-1.5 rounded-full bg-indigo-500" /> {tally.questions} quiz
                            </li>
                          )}
                        </ul>
                        <div className="mt-6 flex gap-2">
                          {(tally.explanations > 0 || tally.flashcards > 0) && (
                            <Link href={`/learn/${set.id}`} className="editorial-btn-secondary flex-1 py-2.5 text-sm">
                              Learn
                            </Link>
                          )}
                          {tally.questions > 0 && (
                            <Link href={`/quiz/${set.id}`} className="editorial-btn-primary flex-1 py-2.5 text-sm">
                              Quiz →
                            </Link>
                          )}
                        </div>
                      </article>
                    </FadeIn>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </EditorialAppPage>
  );
}
