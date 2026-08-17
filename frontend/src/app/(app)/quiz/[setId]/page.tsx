"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  TranslateIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CadoBuddy } from "@/components/cado-buddy";
import { Icon } from "@/components/icon";
import { PageHeader, ProgressBar, Steps } from "@/components/ui";
import { VocabularyText } from "@/components/vocabulary-text";
import { api, StudySet } from "@/lib/api";

type Result = { is_correct: boolean; correct_answer: string; explanation: string; score: number; answered: number };

export default function QuizPage() {
  const { setId } = useParams<{ setId: string }>();
  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [attemptId, setAttemptId] = useState("");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [vocabulary, setVocabulary] = useState(false);
  const questions = useMemo(() => studySet?.items.filter((item) => item.kind === "mcq") ?? [], [studySet]);

  useEffect(() => {
    Promise.all([
      api<StudySet>(`/study-sets/${setId}`),
      api<{ id: string }>("/quiz-attempts", {
        method: "POST",
        body: JSON.stringify({ study_set_id: setId }),
      }),
    ]).then(([set, attempt]) => { setStudySet(set); setAttemptId(attempt.id); }).catch((reason) => setError(reason.message));
  }, [setId]);

  async function answer(option: string) {
    if (result || !attemptId) return;
    setSelected(option);
    try {
      const response = await api<Result>(`/quiz-attempts/${attemptId}/answers`, {
        method: "POST",
        body: JSON.stringify({ item_id: questions[index].id, selected_answer: option }),
      });
      setResult(response);
      setScore(response.score);
      if (response.is_correct && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        confetti({ particleCount: 45, spread: 55, origin: { y: .65 }, colors: ["#4f8a3a", "#8fbf4a", "#f3c14b"] });
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not submit answer"); }
  }

  async function next() {
    if (index === questions.length - 1) {
      await api(`/quiz-attempts/${attemptId}/complete`, { method: "POST" });
      setFinished(true);
    } else {
      setIndex(index + 1);
      setSelected("");
      setResult(null);
    }
  }

  if (error) return <div className="card p-6 text-[var(--danger)]">{error}</div>;
  if (!studySet || !attemptId) return <div className="soft h-96 animate-pulse rounded-3xl" />;
  if (!questions.length) return <div className="card p-8 text-center"><p className="text-xl font-extrabold">This set has no quiz questions.</p><Link href={`/learn/${setId}`} className="btn-primary mt-5">Back to learning</Link></div>;
  if (finished) {
    const percent = Math.round(score / questions.length * 100);
    return (
      <div className="mx-auto max-w-xl py-8 text-center">
        <CadoBuddy size={200} message={percent >= 70 ? "Summit reached. Nice work." : "Detour, not defeat. Review, then try again."} />
        <p className="kicker mt-6">Quiz complete</p>
        <h1 className="mt-2 text-5xl font-black">{percent}%</h1>
        <p className="muted mt-3">You answered {score} of {questions.length} correctly.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href={`/learn/${setId}`} className="btn-secondary">Review set</Link>
          <Link href="/dashboard" className="btn-primary">Back to today</Link>
        </div>
      </div>
    );
  }
  const question = questions[index];
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/learn/${setId}`} className="muted mb-5 inline-flex items-center gap-1 text-sm font-bold"><Icon icon={ArrowLeft01Icon} size={16} /> Back to learn</Link>
      <PageHeader
        kicker="Quiz"
        title={studySet.title}
        subtitle="Pick an answer. You’ll see green or red immediately, then why."
        action={<p className="font-extrabold text-[var(--primary)]">Score {score}/{questions.length}</p>}
      />
      <div className="mb-4 mt-5 flex flex-wrap items-center justify-between gap-3">
        <Steps current={2} items={["Upload", "Learn", "Quiz"]} />
        <button onClick={() => setVocabulary(!vocabulary)} className={`btn-secondary py-2 text-sm ${vocabulary ? "!bg-[var(--primary)] !text-white" : ""}`}>
          <Icon icon={TranslateIcon} size={14} /> Vocabulary
        </button>
      </div>
      <ProgressBar value={((index + (result ? 1 : 0)) / questions.length) * 100} label={`Question ${index + 1} of ${questions.length}`} />
      <motion.section key={question.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="card mt-6 p-6 md:p-9">
        <h2 className="text-2xl font-black leading-9">{question.prompt}</h2>
        <div className="mt-7 space-y-3">
          {question.options?.map((option, optionIndex) => {
            const correct = result && option === result.correct_answer;
            const wrong = result && option === selected && !result.is_correct;
            return <button key={option} disabled={!!result} onClick={() => answer(option)} className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left font-semibold transition ${correct ? "border-[var(--success)] bg-green-500/10" : wrong ? "border-[var(--danger)] bg-red-500/10" : "bg-[var(--surface-2)] hover:border-[var(--primary)]"}`}>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-[var(--surface)] text-sm font-extrabold">{String.fromCharCode(65 + optionIndex)}</span><span className="flex-1">{option}</span>{correct && <Icon icon={CheckmarkCircle02Icon} className="text-[var(--success)]" />}{wrong && <Icon icon={CancelCircleIcon} className="text-[var(--danger)]" />}
            </button>;
          })}
        </div>
        <AnimatePresence>{result && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-6 rounded-2xl p-5 ${result.is_correct ? "bg-green-500/10" : "bg-red-500/10"}`}>
          <p className={`flex items-center gap-2 font-extrabold ${result.is_correct ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{result.is_correct ? <Icon icon={CheckmarkCircle02Icon} size={20} /> : <Icon icon={CancelCircleIcon} size={20} />}{result.is_correct ? "Exactly right!" : "Not quite — keep going."}</p>
          <p className="mt-2 leading-7"><VocabularyText text={result.explanation} enabled={vocabulary} /></p>
          <button onClick={next} className="btn-primary mt-5">{index === questions.length - 1 ? "See results" : "Next question"} <Icon icon={ArrowRight01Icon} size={17} /></button>
        </motion.div>}</AnimatePresence>
      </motion.section>
    </div>
  );
}
