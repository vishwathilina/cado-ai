"use client";

import {
  Add01Icon,
  ArrowRight01Icon,
  BookOpen01Icon,
  ChampionIcon,
  FireIcon,
  SparklesIcon,
  Target01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CadoBuddy } from "@/components/cado-buddy";
import { Icon } from "@/components/icon";
import { PageHeader, ProgressBar } from "@/components/ui";
import { api } from "@/lib/api";

type Dashboard = {
  name: string;
  streak: number;
  accuracy: number;
  quizzes_completed: number;
  weak_topics: string[];
  recent_sets: { id: string; title: string; created_at: string }[];
  study_plan: {
    id: string | null;
    title: string;
    tasks: { id: string; title: string; due_date: string; minutes: number; completed: boolean }[];
  };
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setData(await api<Dashboard>("/dashboard"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load dashboard");
    }
  }

  useEffect(() => {
    let active = true;
    api<Dashboard>("/dashboard")
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load dashboard");
      });
    return () => {
      active = false;
    };
  }, []);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await api("/study-plans", {
        method: "POST",
        body: JSON.stringify({
          goal: form.get("goal"),
          minutes_per_day: Number(form.get("minutes")),
        }),
      });
      setCreating(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create plan");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(id: string) {
    await api(`/study-tasks/${id}`, { method: "PATCH" });
    await load();
  }

  const todayKey = new Date().toDateString();
  const tasks = useMemo(() => data?.study_plan.tasks ?? [], [data]);
  const done = tasks.filter((task) => task.completed).length;
  const todayTask = useMemo(
    () =>
      tasks.find((task) => !task.completed && new Date(task.due_date).toDateString() === todayKey) ??
      tasks.find((task) => !task.completed),
    [tasks, todayKey],
  );
  const nextSet = data?.recent_sets[0];

  if (error) return <div className="card p-6 text-[var(--danger)]">{error}</div>;
  if (!data) return <div className="animate-pulse space-y-5"><div className="soft h-28 rounded-3xl" /><div className="soft h-64 rounded-3xl" /></div>;

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Study hub"
        title={`Hi ${data.name.split(" ")[0]}, here’s today.`}
        subtitle="One task, one set, then stop if you want. Cado will keep the trail marked."
        action={<Link href="/upload" className="btn-primary"><Icon icon={Add01Icon} size={18} /> New study set</Link>}
      />

      <section className="card today-card grid gap-5 p-6 md:grid-cols-[1fr_160px] md:items-center">
        <div>
          <p className="kicker">Today’s hike</p>
          {todayTask ? (
            <>
              <h2 className="mt-2 text-2xl font-black">{todayTask.title}</h2>
              <p className="muted mt-2 text-sm">{todayTask.minutes} minutes · {new Date(todayTask.due_date).toLocaleDateString(undefined, { weekday: "long" })}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={() => toggleTask(todayTask.id)} className="btn-primary py-2 text-sm">
                  <Icon icon={Tick02Icon} size={16} /> Mark done
                </button>
                {nextSet ? (
                  <Link href={`/learn/${nextSet.id}`} className="btn-secondary py-2 text-sm">Open latest set</Link>
                ) : (
                  <Link href="/upload" className="btn-secondary py-2 text-sm">Upload notes first</Link>
                )}
              </div>
            </>
          ) : data.study_plan.id ? (
            <>
              <h2 className="mt-2 text-2xl font-black">This week’s trail is clear.</h2>
              <p className="muted mt-2 text-sm">Every task is done. Build a new plan or review a set.</p>
              <button onClick={() => setCreating(true)} className="btn-primary mt-5 py-2 text-sm">Build next week</button>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-2xl font-black">Let’s map the week.</h2>
              <p className="muted mt-2 text-sm">Tell Cado your goal and daily time. You’ll get seven focused tasks.</p>
              <button onClick={() => setCreating(true)} className="btn-primary mt-5 py-2 text-sm"><Icon icon={SparklesIcon} size={16} /> Build my plan</button>
            </>
          )}
        </div>
        <CadoBuddy size={150} message={todayTask ? "One hill. Then rest." : "I’ll pack the week for you."} />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: FireIcon, value: data.streak, label: "day streak" },
          { icon: Target01Icon, value: `${data.accuracy}%`, label: "quiz accuracy" },
          { icon: ChampionIcon, value: data.quizzes_completed, label: "quizzes done" },
        ].map((stat) => (
            <article key={stat.label} className="card flex items-center gap-4 p-5">
              <span className="soft grid size-12 place-items-center rounded-2xl text-[var(--primary)]">
                <Icon icon={stat.icon} />
              </span>
              <div>
                <p className="text-2xl font-black">{stat.value}</p>
                <p className="muted text-sm">{stat.label}</p>
              </div>
            </article>
          ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
        <article className="card p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-extrabold">{data.study_plan.title}</p>
              <p className="muted text-sm">Seven-day plan · tap a task when you finish it</p>
            </div>
            <button onClick={() => setCreating(!creating)} className="btn-secondary py-2 text-sm">
              <Icon icon={SparklesIcon} size={14} /> {data.study_plan.id ? "Rebuild" : "Build"}
            </button>
          </div>
          {tasks.length > 0 && <div className="mb-5"><ProgressBar value={(done / tasks.length) * 100} label={`${done} of ${tasks.length} complete`} /></div>}
          {creating && (
            <form onSubmit={createPlan} className="soft mb-5 grid gap-3 rounded-2xl p-4">
              <label className="text-sm font-bold">Goal
                <input name="goal" required placeholder="e.g. Master cell biology before Friday" className="field mt-2" />
              </label>
              <label className="text-sm font-bold">Minutes each day
                <input name="minutes" type="number" min={10} max={240} defaultValue={30} className="field mt-2" />
              </label>
              <button disabled={saving} className="btn-primary">{saving ? "Building…" : "Generate 7-day plan"}</button>
            </form>
          )}
          {tasks.length ? (
            <div className="space-y-2">
              {tasks.map((task) => {
                const isToday = new Date(task.due_date).toDateString() === todayKey;
                return (
                  <button key={task.id} onClick={() => toggleTask(task.id)} className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left ${isToday && !task.completed ? "today-card" : "soft"}`}>
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full border ${task.completed ? "bg-[var(--success)] text-white" : "bg-[var(--surface)]"}`}>
                      {task.completed && <Icon icon={Tick02Icon} size={16} />}
                    </span>
                    <span className="flex-1">
                      <span className={`block font-bold ${task.completed ? "line-through opacity-60" : ""}`}>{task.title}</span>
                      <span className="muted text-xs">{isToday ? "Today" : new Date(task.due_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                    </span>
                    <span className="muted text-sm">{task.minutes} min</span>
                  </button>
                );
              })}
            </div>
          ) : !creating && (
            <p className="muted text-sm">No plan yet. Start with a goal and Cado will schedule the week.</p>
          )}
        </article>

        <article className="card p-6">
          <h2 className="text-lg font-extrabold">Continue studying</h2>
          <div className="mt-5 space-y-3">
            {data.recent_sets.map((set) => (
              <div key={set.id} className="soft rounded-2xl p-4">
                <p className="flex items-center gap-2 font-bold"><Icon icon={BookOpen01Icon} size={16} className="text-[var(--primary)]" /> {set.title}</p>
                <p className="muted mt-1 text-xs">{new Date(set.created_at).toLocaleDateString()}</p>
                <div className="mt-3 flex gap-2">
                  <Link href={`/learn/${set.id}`} className="btn-secondary flex-1 py-2 text-sm">Learn</Link>
                  <Link href={`/quiz/${set.id}`} className="btn-primary flex-1 py-2 text-sm">Quiz</Link>
                </div>
              </div>
            ))}
            {!data.recent_sets.length && (
              <div>
                <p className="muted mb-4 text-sm">Upload notes to get explanations, flashcards, and a quiz.</p>
                <Link href="/upload" className="btn-primary w-full">Start with a PDF <Icon icon={ArrowRight01Icon} size={16} /></Link>
              </div>
            )}
          </div>
          {!!data.weak_topics.length && (
            <div className="mt-6 border-t pt-5">
              <p className="text-sm font-extrabold">Review these</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.weak_topics.map((topic) => (
                  <span key={topic} className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-700">{topic}</span>
                ))}
              </div>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
