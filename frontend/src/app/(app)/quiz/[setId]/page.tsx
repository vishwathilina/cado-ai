"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Bookmark02Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Menu01Icon,
  Share08Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { pageEase } from "@/components/page-transition";
import { VocabularyText } from "@/components/vocabulary-text";
import { api } from "@/lib/api";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string | null;
};

type QuizPaper = {
  title: string;
  questions: QuizQuestion[];
  owned?: boolean;
};

type Result = {
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
};

type OptionExplain = {
  text: string;
  correct: boolean;
  why: string;
};

function FullExplain({ attemptId, itemId }: { attemptId: string; itemId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<OptionExplain[] | null>(null);

  async function load() {
    if (options) {
      setOpen((current) => !current);
      return;
    }
    if (!attemptId) {
      setError("This quiz is still starting. Try again in a moment.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = await api<{ options: OptionExplain[] }>(
        `/quiz-attempts/${attemptId}/items/${itemId}/full-explain`,
        { method: "POST" },
      );
      setOptions(payload.options);
      setOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load a full explanation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" className="btn-secondary py-1.5 text-sm" onClick={() => void load()} disabled={loading}>
        {loading ? "Writing…" : open ? "Hide full explain" : "Full explain"}
      </button>
      {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
      {open && options && (
        <ul className="mt-3 space-y-2 text-left">
          {options.map((option) => (
            <li key={option.text} className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm">
              <p className={`font-semibold ${option.correct ? "text-[var(--success)]" : ""}`}>
                {option.correct ? "Correct" : "Incorrect"} · {option.text}
              </p>
              <p className="muted mt-1 leading-6">{option.why}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function quizReaction(percent: number) {
  if (percent < 40) {
    return {
      src: "/cadoreaction/sad.gif",
      message: "Rough round. The list on the right is your next pass.",
    };
  }
  if (percent < 60) {
    return {
      src: "/cadoreaction/hi.gif",
      message: "A start. Let's tighten the ones you missed.",
    };
  }
  if (percent < 85) {
    return {
      src: "/cadoreaction/happydance.gif",
      message: "Nice work. A few more and you'll own this.",
    };
  }
  return {
    src: "/cadoreaction/love.gif",
    message: "Summit reached. You knew this set.",
  };
}

function TallyPills({ correct, wrong }: { correct: number; wrong: number }) {
  return (
    <div className="quiz-tally" aria-live="polite" aria-label={`${wrong} incorrect, ${correct} correct`}>
      <span className="quiz-tally-pill is-wrong">
        <Icon icon={Cancel01Icon} size={13} />
        {wrong}
      </span>
      <span className="quiz-tally-pill is-right">
        <Icon icon={Tick02Icon} size={13} />
        {correct}
      </span>
    </div>
  );
}

export default function QuizPage() {
  const { setId } = useParams<{ setId: string }>();
  const reduceMotion = useReducedMotion();
  const [paper, setPaper] = useState<QuizPaper | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [finishAsk, setFinishAsk] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const [saveError, setSaveError] = useState("");
  const attemptId = useRef("");
  const attemptReady = useRef<Promise<string>>(Promise.resolve(""));
  const answers = useRef<{ item_id: string; selected_answer: string }[]>([]);
  const saved = useRef(false);
  const locked = useRef(false);

  useEffect(() => {
    let active = true;
    saved.current = false;
    answers.current = [];
    attemptId.current = "";
    api<QuizPaper>(`/study-sets/${setId}/quiz`)
      .then((payload) => {
        if (active) setPaper(payload);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load quiz");
      });
    attemptReady.current = api<{ id: string }>("/quiz-attempts", {
      method: "POST",
      body: JSON.stringify({ study_set_id: setId }),
    }).then((payload) => {
      attemptId.current = payload.id;
      return payload.id;
    });
    attemptReady.current.catch(() => {});
    return () => {
      active = false;
    };
  }, [setId]);

  useEffect(() => {
    if (finished || !paper) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [finished, paper]);

  const questions = paper?.questions ?? [];
  const question = questions[index];
  const answeredIds = useMemo(() => new Set(answers.current.map((entry) => entry.item_id)), [index, result, finished]);
  const tally = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    for (const entry of answers.current) {
      const item = questions.find((row) => row.id === entry.item_id);
      if (!item) continue;
      if (entry.selected_answer === item.answer) correct += 1;
      else wrong += 1;
    }
    return { correct, wrong };
  }, [index, result, finished, questions]);

  function showQuestion(nextIndex: number) {
    const next = questions[nextIndex];
    if (!next) return;
    const existing = answers.current.find((entry) => entry.item_id === next.id);
    setIndex(nextIndex);
    setNavOpen(false);
    if (existing) {
      locked.current = true;
      setSelected(existing.selected_answer);
      setResult({
        is_correct: existing.selected_answer === next.answer,
        correct_answer: next.answer,
        explanation: next.explanation || "Review the source material for this answer.",
      });
      return;
    }
    locked.current = false;
    setSelected("");
    setResult(null);
  }

  function saveRun() {
    if (saved.current) return;
    saved.current = true;
    setSaveError("");
    void attemptReady.current
      .then((id) => {
        if (!id) throw new Error("missing attempt");
        return api(`/quiz-attempts/${id}/finish`, {
          method: "POST",
          body: JSON.stringify({ answers: answers.current }),
        });
      })
      .catch((reason) => {
        saved.current = false;
        setSaveError(reason instanceof Error ? reason.message : "Could not save this quiz");
      });
  }

  function requestFinish() {
    if (answeredIds.size < questions.length) {
      setFinishAsk(true);
      return;
    }
    setFinishAsk(false);
    setFinished(true);
    saveRun();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/quiz/${setId}`);
      setShareNote("Link copied. Friends must sign in to take it.");
    } catch {
      setShareNote("Could not copy the link.");
    }
  }

  function answer(option: string) {
    if (locked.current || result || !question) return;
    locked.current = true;
    const correct = option === question.answer;
    setSelected(option);
    setResult({
      is_correct: correct,
      correct_answer: question.answer,
      explanation: question.explanation || "Review the source material for this answer.",
    });
    if (correct) setScore((value) => value + 1);
    answers.current = [
      ...answers.current.filter((entry) => entry.item_id !== question.id),
      { item_id: question.id, selected_answer: option },
    ];
  }

  function goNext() {
    if (index === questions.length - 1) {
      requestFinish();
      return;
    }
    showQuestion(index + 1);
  }

  function skip() {
    if (index === questions.length - 1) {
      requestFinish();
      return;
    }
    showQuestion(index + 1);
  }

  function retry() {
    saved.current = false;
    answers.current = [];
    locked.current = false;
    setFinished(false);
    setIndex(0);
    setSelected("");
    setResult(null);
    setScore(0);
    setElapsed(0);
    setFlagged([]);
    setError("");
    setSaveError("");
    setFinishAsk(false);
    setShareNote("");
    const started = api<{ id: string }>("/quiz-attempts", {
      method: "POST",
      body: JSON.stringify({ study_set_id: setId }),
    }).then((payload) => {
      attemptId.current = payload.id;
      return payload.id;
    });
    attemptReady.current = started;
    started.catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Could not restart quiz");
    });
  }

  function toggleFlag() {
    if (!question) return;
    setFlagged((current) =>
      current.includes(question.id) ? current.filter((id) => id !== question.id) : [...current, question.id],
    );
  }

  if (error) return <div className="grid min-h-screen place-items-center p-6"><div className="card p-6 text-[var(--danger)]">{error}</div></div>;
  if (!paper) return <div className="grid min-h-screen place-items-center"><div className="soft h-24 w-64 animate-pulse rounded-2xl" /></div>;
  if (!questions.length) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="card max-w-md p-8 text-center">
          <p className="font-display text-xl font-semibold">This set has no quiz questions.</p>
          {paper.owned !== false && (
            <Link href={`/learn/${setId}`} className="btn-primary mt-5">Back to learning</Link>
          )}
        </div>
      </div>
    );
  }
  if (finished) {
    const percent = Math.round((score / questions.length) * 100);
    const review = questions
      .map((item, itemIndex) => {
        const entry = answers.current.find((answer) => answer.item_id === item.id);
        if (!entry) return { item, itemIndex, status: "skipped" as const };
        if (entry.selected_answer !== item.answer) return { item, itemIndex, status: "missed" as const };
        return null;
      })
      .filter((row) => row !== null);
    const missedCount = review.filter((row) => row.status === "missed").length;
    const skippedCount = review.filter((row) => row.status === "skipped").length;
    const reaction = quizReaction(percent);
    const owned = paper.owned !== false;
    return (
      <div className="flex h-dvh flex-col overflow-hidden p-5 md:p-8">
        <div className="mx-auto grid h-full min-h-0 w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(17rem,0.85fr)_minmax(0,1.15fr)] lg:grid-rows-1">
          <div className="flex min-h-0 shrink-0 flex-col items-center overflow-y-auto overflow-x-hidden text-center lg:px-6">
            <figure className="buddy">
              <img src={reaction.src} alt="" className="quiz-reaction" />
              <figcaption className="buddy-bubble">{reaction.message}</figcaption>
            </figure>
            <p className="kicker mt-6">Quiz complete</p>
            <h1 className="font-display mt-2 text-5xl font-semibold md:text-6xl">{percent}%</h1>
            <div className="quiz-pie-wrap">
              <div
                className="quiz-pie"
                style={{
                  background: `conic-gradient(var(--success) ${(score / questions.length) * 360}deg, var(--danger) 0)`,
                }}
                aria-label={`${score} of ${questions.length} correct`}
              >
                <span className="quiz-pie-score">{score}/{questions.length}</span>
              </div>
              <div className="quiz-pie-legend">
                <span><i className="quiz-pie-dot is-right" /> {score} correct</span>
                <span><i className="quiz-pie-dot is-wrong" /> {missedCount} missed</span>
                {skippedCount > 0 && (
                  <span><i className="quiz-pie-dot is-skip" /> {skippedCount} skipped</span>
                )}
              </div>
            </div>
            <p className="muted mt-3 max-w-sm">
              You answered {score} of {questions.length} correctly in {formatTime(elapsed)}.
            </p>
            {saveError && <p className="mt-3 text-sm text-[var(--danger)]">{saveError}</p>}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={retry} className="btn-secondary">Try again</button>
              {owned && (
                <Link href={`/learn/${setId}`} className="btn-primary">
                  {review.length ? "Learn these parts" : "Review set"}
                </Link>
              )}
              {owned && (
                <button type="button" onClick={() => void copyLink()} className="btn-secondary">
                  <Icon icon={Share08Icon} size={16} /> Share
                </button>
              )}
              <Link href="/dashboard" className="btn-secondary">Back to today</Link>
            </div>
            {shareNote && <p className="muted mt-3 text-sm">{shareNote}</p>}
          </div>
          {review.length ? (
            <section className="card flex min-h-0 flex-col p-5 text-left">
              <h2 className="shrink-0 text-lg font-semibold">Learn these more</h2>
              <p className="muted mt-1 shrink-0 text-sm">You missed or skipped these. Start here on the next pass.</p>
              <ol className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
                {review.map((row) => (
                  <li key={row.item.id} className="rounded-xl bg-[var(--surface-2)] px-4 py-3">
                    <p className="muted text-xs font-semibold uppercase tracking-wide">
                      Question {row.itemIndex + 1} · {row.status === "missed" ? "Missed" : "Skipped"}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-6">{row.item.prompt}</p>
                    {row.status === "missed" && (
                      <p className="mt-1 text-xs font-semibold text-[var(--success)]">Correct: {row.item.answer}</p>
                    )}
                    {row.item.explanation && (
                      <p className="muted mt-2 text-sm leading-6">{row.item.explanation}</p>
                    )}
                    <FullExplain attemptId={attemptId.current} itemId={row.item.id} />
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <div className="grid min-h-0 place-items-center">
              <p className="text-sm font-medium">Nothing to drill — you knew this set.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const subsection = (
    <aside className="flex h-full min-h-0 w-64 flex-col border-r bg-[var(--surface)] p-4">
      <p className="kicker shrink-0 px-2">Questions</p>
      <p className="font-display mt-1 shrink-0 px-2 text-lg font-semibold">{paper.title}</p>
      <ol className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
        {questions.map((item, itemIndex) => {
          const entry = answers.current.find((answer) => answer.item_id === item.id);
          const answered = Boolean(entry);
          const correct = answered && entry?.selected_answer === item.answer;
          const flaggedItem = flagged.includes(item.id);
          const current = itemIndex === index;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => showQuestion(itemIndex)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  current ? "bg-[var(--surface-2)] font-semibold" : "muted hover:bg-[var(--surface-2)]"
                }`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold ${
                    current && !answered
                      ? "bg-[var(--primary)] text-white"
                      : correct
                        ? "bg-[color-mix(in_srgb,var(--success)_18%,var(--surface))] text-[var(--success)]"
                        : answered
                          ? "bg-[color-mix(in_srgb,var(--danger)_18%,var(--surface))] text-[var(--danger)]"
                          : current
                            ? "bg-[var(--primary)] text-white"
                            : "bg-[var(--surface-2)]"
                  }`}
                >
                  {correct ? <Icon icon={Tick02Icon} size={12} /> : answered ? <Icon icon={Cancel01Icon} size={12} /> : itemIndex + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">Question {itemIndex + 1}</span>
                {flaggedItem && <Icon icon={Bookmark02Icon} size={14} className="text-[var(--danger)]" />}
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--background)]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-[var(--surface)] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Questions">
            <Icon icon={Menu01Icon} />
          </button>
          {paper.owned !== false && (
            <Link href={`/learn/${setId}`} className="muted inline-flex items-center gap-1 text-sm font-semibold">
              <Icon icon={ArrowLeft01Icon} size={16} /> Learn
            </Link>
          )}
          <h1 className="font-display hidden truncate text-base font-semibold sm:block">{paper.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <TallyPills correct={tally.correct} wrong={tally.wrong} />
          <span className="timer-pill text-sm">
            <Icon icon={Clock01Icon} size={14} />
            {formatTime(elapsed)}
          </span>
          <span className="timer-pill hidden text-sm sm:inline-flex">Question {index + 1} of {questions.length}</span>
          {paper.owned !== false && (
            <button type="button" onClick={() => void copyLink()} className="hidden items-center gap-1 px-2 text-sm font-medium sm:inline-flex">
              <Icon icon={Share08Icon} size={16} /> Share
            </button>
          )}
          <button
            type="button"
            onClick={toggleFlag}
            className={`hidden items-center gap-1 px-2 text-sm font-medium sm:inline-flex ${flagged.includes(question.id) ? "text-[var(--danger)]" : "muted"}`}
          >
            <Icon icon={Bookmark02Icon} size={16} /> Mark for review
          </button>
          <button type="button" onClick={requestFinish} className="btn-secondary py-1.5 text-sm">
            Finish
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="hidden h-full min-h-0 lg:flex">{subsection}</div>
        {navOpen && (
          <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setNavOpen(false)}>
            <div className="h-full max-w-[16.5rem]" onClick={(event) => event.stopPropagation()}>{subsection}</div>
          </div>
        )}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mx-auto flex w-full min-h-0 max-w-4xl flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-8 md:px-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={question.id}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: pageEase }}
              >
            <h2 className="font-display text-2xl font-semibold leading-snug md:text-3xl">{question.prompt}</h2>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {question.options.map((option, optionIndex) => {
                const state = result
                  ? option === result.correct_answer
                    ? "correct"
                    : option === selected
                      ? "wrong"
                      : "idle"
                  : option === selected
                    ? "selected"
                    : "idle";
                return (
                  <button
                    key={`${question.id}-${optionIndex}`}
                    type="button"
                    disabled={!!result}
                    onClick={() => answer(option)}
                    className="quiz-choice"
                    data-state={state}
                  >
                    <span className="quiz-radio" />
                    <span>
                      <span className="muted mr-2 text-xs font-semibold">{String.fromCharCode(65 + optionIndex)}</span>
                      {option}
                    </span>
                    {state === "correct" && <Icon icon={CheckmarkCircle02Icon} className="ml-auto text-[var(--success)]" />}
                    {state === "wrong" && <Icon icon={CancelCircleIcon} className="ml-auto text-[var(--danger)]" />}
                  </button>
                );
              })}
            </div>
            {result && (
              <div className={`quiz-feedback ${result.is_correct ? "is-correct" : "is-wrong"}`}>
                <p className={`flex items-center gap-2 font-semibold ${result.is_correct ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {result.is_correct ? <Icon icon={CheckmarkCircle02Icon} size={18} /> : <Icon icon={CancelCircleIcon} size={18} />}
                  {result.is_correct ? "Exactly right" : "Not quite — keep going"}
                </p>
                <p className="mt-2 text-sm leading-7">
                  <VocabularyText text={result.explanation} enabled={false} />
                </p>
                <FullExplain attemptId={attemptId.current} itemId={question.id} />
              </div>
            )}
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className="shrink-0 border-t bg-[var(--surface)] px-5 py-4 md:px-10">
            {finishAsk && (
              <div className="confirm-banner mx-auto mb-3 max-w-4xl">
                <p className="text-sm font-semibold">Finish with unanswered questions?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary py-2 text-sm" onClick={() => setFinishAsk(false)}>Keep going</button>
                  <button
                    type="button"
                    className="btn-primary py-2 text-sm"
                    onClick={() => {
                      setFinishAsk(false);
                      setFinished(true);
                      saveRun();
                    }}
                  >
                    Finish
                  </button>
                </div>
              </div>
            )}
            {shareNote && <p className="muted mx-auto mb-2 max-w-4xl text-sm">{shareNote}</p>}
            <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3">
              <p className="muted text-sm">{answeredIds.size} / {questions.length} answered</p>
              <div className="flex gap-2">
                <button type="button" disabled={index === 0} onClick={() => showQuestion(index - 1)} className="btn-secondary py-2 text-sm disabled:opacity-40">
                  <Icon icon={ArrowLeft01Icon} size={16} /> Back
                </button>
                {!result && (
                  <button type="button" onClick={skip} className="btn-secondary py-2 text-sm">Skip</button>
                )}
                <button type="button" onClick={goNext} className="btn-primary py-2 text-sm">
                  {index === questions.length - 1 ? "See results" : "Next"} <Icon icon={ArrowRight01Icon} size={16} />
                </button>
              </div>
            </div>
            <div className="mx-auto mt-3 max-w-4xl">
              <div className="progress-track">
                <span style={{ width: `${(answeredIds.size / questions.length) * 100}%` }} />
              </div>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
