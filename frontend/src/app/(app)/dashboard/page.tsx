"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  MoreHorizontalIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DatePicker } from "@/components/date-calendar";
import { Icon } from "@/components/icon";
import { StudyPlans, type StudyPlan } from "@/components/study-plans";
import { FadeIn } from "@/components/page-transition";
import { ProgressBar } from "@/components/ui";
import { api } from "@/lib/api";
import { isoDate } from "@/lib/dates";

type StudyCard = {
  id: string;
  title: string;
  language: string;
  created_at: string;
  question_count: number;
  last_score: number | null;
  last_total: number | null;
};

type Achievement = {
  id: string;
  title: string;
  achieved_on: string;
};

type Countdown = {
  id: string;
  title: string;
  ends_at: string;
};

type WeakTopic = {
  id: string;
  title: string;
  set_id: string;
  set_title: string;
  misses: number;
};

type Dashboard = {
  name: string;
  email: string;
  streak: number;
  accuracy: number;
  quizzes_completed: number;
  weak_topics: WeakTopic[];
  recent_sets: StudyCard[];
  study_plans: StudyPlan[];
  study_plan: StudyPlan & { id: string | null };
  achievements: Achievement[];
  countdowns: Countdown[];
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function remainingLabel(endsAt: string, now: number) {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Time’s up";
  const hoursTotal = Math.floor(ms / 3_600_000);
  const days = Math.floor(hoursTotal / 24);
  const hours = hoursTotal % 24;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${Math.max(1, minutes)}m left`;
}

function weekDays(anchor = new Date()) {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [statsOpen, setStatsOpen] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => isoDate());
  const [newAchievement, setNewAchievement] = useState("");
  const [countdownTitle, setCountdownTitle] = useState("");
  const [countdownDate, setCountdownDate] = useState(() => isoDate());
  const [now, setNow] = useState(() => Date.now());

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

  const todayKey = new Date().toDateString();
  const month = new Date().getMonth();
  const monthTasks = useMemo(
    () =>
      (data?.study_plans ?? [])
        .flatMap((plan) => plan.tasks)
        .filter((task) => new Date(task.due_date).getMonth() === month),
    [data, month],
  );
  const done = monthTasks.filter((task) => task.completed).length;
  const monthPct = monthTasks.length ? Math.round((done / monthTasks.length) * 100) : 0;
  const nextSet = data?.recent_sets[0];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return data?.recent_sets ?? [];
    return (data?.recent_sets ?? []).filter((set) => set.title.toLowerCase().includes(term));
  }, [data, query]);
  const pageSize = 3;
  const maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const days = useMemo(() => weekDays(), []);
  const quizHref = nextSet && nextSet.question_count > 0 ? `/quiz/${nextSet.id}` : nextSet ? `/learn/${nextSet.id}` : "/upload";

  useEffect(() => {
    setPage(0);
  }, [query]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (error) return <div className="p-6 md:p-8"><div className="card p-6 text-[var(--danger)]">{error}</div></div>;
  if (!data) {
    return (
      <div className="grid gap-4 p-6 md:p-8 xl:grid-cols-[1fr_19rem]">
        <div className="animate-pulse space-y-4">
          <div className="soft h-12 rounded-2xl" />
          <div className="soft h-44 rounded-3xl" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="soft h-36 rounded-3xl" />
            <div className="soft h-36 rounded-3xl" />
            <div className="soft h-36 rounded-3xl" />
          </div>
        </div>
        <div className="soft hidden h-[32rem] rounded-3xl xl:block" />
      </div>
    );
  }

  const firstName = data.name.split(" ")[0];
  const monthLabel = new Date().toLocaleDateString(undefined, { month: "long" });

  const stats = (
    <aside className="flex h-full flex-col bg-[var(--surface-2)] p-5 xl:min-h-screen">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f3803b] text-sm font-semibold text-white">
            {initials(data.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data.name}</p>
            <p className="muted truncate text-xs">{data.streak} day streak · {data.accuracy}% accuracy</p>
          </div>
        </div>
        <button onClick={() => setStatsOpen(false)} className="nav-rail-item" aria-label="Hide statistics">
          <Icon icon={Cancel01Icon} size={16} />
        </button>
      </div>

      <div className="rounded-2xl bg-[var(--surface)] p-4">
        <p className="mb-3 font-semibold">{data.weak_topics.length ? "Needs review" : "Your stats"}</p>
        {data.weak_topics.length ? (
          <div className="flex flex-col">
            {data.weak_topics.map((topic, index) => (
              <Link key={topic.id} href={`/quiz/${topic.set_id}`} className="dash-review">
                <span className="dash-review-rank">#{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{topic.title}</p>
                  <p className="muted mt-0.5 text-xs">
                    {topic.set_title} · missed {topic.misses}×
                  </p>
                </div>
                <span className="dash-review-go">
                  Retry <Icon icon={ArrowRight01Icon} size={14} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            <Link href="/history" className="dash-review">
              <span className="dash-review-rank">{data.streak}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Day streak</p>
                <p className="muted text-xs">See everything you’ve generated</p>
              </div>
              <span className="dash-review-go">
                History <Icon icon={ArrowRight01Icon} size={14} />
              </span>
            </Link>
            <Link href="/history" className="dash-review">
              <span className="dash-review-rank">{data.accuracy}%</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Quiz accuracy</p>
                <p className="muted text-xs">Across scored quizzes</p>
              </div>
              <span className="dash-review-go">
                Review <Icon icon={ArrowRight01Icon} size={14} />
              </span>
            </Link>
            <Link href="/upload" className="dash-review">
              <span className="dash-review-rank">{data.quizzes_completed}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Quizzes done</p>
                <p className="muted text-xs">Upload notes for another set</p>
              </div>
              <span className="dash-review-go">
                Upload <Icon icon={ArrowRight01Icon} size={14} />
              </span>
            </Link>
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl bg-[var(--surface)] p-4">
        <p className="mb-3 font-semibold">Countdowns</p>
        {(data.countdowns ?? []).length ? (
          <div className="mb-3 space-y-2">
            {data.countdowns.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                <span className="muted shrink-0 text-xs tabular-nums">{remainingLabel(item.ends_at, now)}</span>
                <button
                  type="button"
                  className="muted text-xs"
                  aria-label="Remove countdown"
                  onClick={async () => {
                    await api(`/countdowns/${item.id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted mb-3 text-sm">Count down to an exam or deadline.</p>
        )}
        <form
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!countdownTitle.trim() || !countdownDate) return;
            try {
              await api("/countdowns", {
                method: "POST",
                body: JSON.stringify({
                  title: countdownTitle.trim(),
                  ends_on: countdownDate,
                }),
              });
              setCountdownTitle("");
              setCountdownDate(isoDate());
              await load();
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Could not add countdown");
            }
          }}
        >
          <input
            value={countdownTitle}
            onChange={(event) => setCountdownTitle(event.target.value)}
            placeholder="Exam, deadline…"
            className="field col-span-2 py-2 text-sm"
          />
          <DatePicker value={countdownDate} onChange={setCountdownDate} min={isoDate()} className="min-w-0" />
          <button className="btn-primary py-2 text-sm" type="submit">Add</button>
        </form>
      </div>

      <div className="mt-5 rounded-2xl bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-semibold">This month</p>
          <span className="rounded-full bg-[#f3803b] px-2.5 py-1 text-[11px] font-semibold text-white">{monthLabel}</span>
        </div>
        {monthTasks.length ? (
          <div className="dash-progress flex items-center gap-3">
            <div className="flex-1"><ProgressBar value={monthPct} /></div>
            <span className="text-sm font-semibold">{monthPct}%</span>
          </div>
        ) : (
          <p className="muted text-sm">Plan tasks will count toward this month.</p>
        )}
      </div>

      <div className="mt-5 rounded-2xl bg-[var(--surface)] p-4">
        <p className="mb-3 font-semibold">Wins</p>
        <form
          className="mb-3 flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!newAchievement.trim()) return;
            try {
              await api("/achievements", {
                method: "POST",
                body: JSON.stringify({ title: newAchievement.trim(), achieved_on: selectedDate }),
              });
              setNewAchievement("");
              await load();
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Could not add achievement");
            }
          }}
        >
          <input
            value={newAchievement}
            onChange={(event) => setNewAchievement(event.target.value)}
            placeholder="Add a win"
            className="field flex-1 py-2 text-sm"
          />
          <button className="btn-primary py-2 text-sm" type="submit">Add</button>
        </form>
        {(data.achievements ?? []).length ? (
          <div className="space-y-2">
            {data.achievements.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                <span className="muted shrink-0 text-xs">{isoDate(item.achieved_on).slice(5)}</span>
                <button
                  type="button"
                  className="muted text-xs"
                  aria-label="Remove achievement"
                  onClick={async () => {
                    await api(`/achievements/${item.id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted text-sm">Log a milestone for this month.</p>
        )}
      </div>
    </aside>
  );

  return (
    <div className={`min-h-full bg-[var(--background)] xl:grid ${statsOpen ? "xl:grid-cols-[1fr_20rem]" : ""}`}>
      <div className="p-5 md:p-8">
        <header className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="muted text-sm font-semibold">Today</p>
            <h1 className="truncate text-3xl font-semibold">Hi, {firstName}</h1>
          </div>
          <label className="relative min-w-[12rem] flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[var(--muted)]">
              <Icon icon={Search01Icon} size={16} />
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your tests"
              className="dash-search"
            />
          </label>
          <Link href={quizHref} className="btn-primary shrink-0 py-2.5 text-sm">
            Take quiz
          </Link>
          {!statsOpen && (
            <button
              onClick={() => setStatsOpen(true)}
              className="grid size-10 place-items-center rounded-full bg-[#f3803b] text-sm font-semibold text-white"
              aria-label="Show statistics"
            >
              {initials(data.name)}
            </button>
          )}
        </header>

        <section className="mt-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="min-w-0 shrink-0 text-xl font-semibold">Continue studying</h2>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                disabled={page === 0}
                className="nav-rail-item disabled:opacity-30"
                aria-label="Previous sets"
              >
                <Icon icon={ArrowLeft01Icon} size={16} />
              </button>
              <button
                onClick={() => setPage((value) => Math.min(maxPage, value + 1))}
                disabled={page >= maxPage}
                className="nav-rail-item disabled:opacity-30"
                aria-label="Next sets"
              >
                <Icon icon={ArrowRight01Icon} size={16} />
              </button>
            </div>
          </div>
          {visible.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {visible.map((set, index) => {
                const total = set.last_total || set.question_count;
                const doneCount = set.last_score ?? 0;
                const href = set.question_count > 0 ? `/quiz/${set.id}` : `/learn/${set.id}`;
                return (
                  <FadeIn key={set.id} delay={index * 0.05} className="h-full">
                  <article className="card relative flex min-h-[9.5rem] flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--muted)]">
                        {total ? `${doneCount}/${total}` : "New"}
                      </p>
                      <details className="relative">
                        <summary className="flex cursor-pointer list-none text-[var(--muted)] [&::-webkit-details-marker]:hidden">
                          <Icon icon={MoreHorizontalIcon} size={16} />
                        </summary>
                        <div className="absolute right-0 z-10 mt-1 w-28 overflow-hidden rounded-xl border bg-[var(--surface)] py-1 text-sm shadow-sm">
                          <Link href={`/learn/${set.id}`} className="block px-3 py-1.5 hover:bg-[var(--surface-2)]">Learn</Link>
                          {set.question_count > 0 && (
                            <Link href={`/quiz/${set.id}`} className="block px-3 py-1.5 hover:bg-[var(--surface-2)]">Quiz</Link>
                          )}
                        </div>
                      </details>
                    </div>
                    <Link href={href} className="mt-auto pt-6">
                      <p className="text-xs font-medium text-[var(--muted)]">{set.language || "Study set"}</p>
                      <p className="mt-1 line-clamp-2 font-semibold leading-snug">{set.title}</p>
                    </Link>
                  </article>
                  </FadeIn>
                );
              })}
            </div>
          ) : (
            <div className="card p-6">
              <p className="muted mb-4 text-sm">
                {query ? "No sets match that search." : "Upload notes to get explanations, flashcards, and a quiz."}
              </p>
              <Link href="/upload" className="btn-primary">Upload notes</Link>
            </div>
          )}
        </section>

        <section className="mt-9">
          <div className="mb-2 flex justify-end">
            <div>
              <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
                  <span key={`${label}-${index}`} className="grid w-8 place-items-center">{label}</span>
                ))}
              </div>
              <div className="mt-1 flex">
                {days.map((day) => {
                  const key = isoDate(day);
                  const isToday = day.toDateString() === todayKey;
                  const selected = key === selectedDate;
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setSelectedDate(key)}
                      className={`dash-day text-sm ${isToday ? "is-today" : ""} ${selected ? "is-selected" : ""}`}
                      aria-label={day.toLocaleDateString()}
                      aria-pressed={selected}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <StudyPlans plans={data.study_plans} selectedDate={selectedDate} onChange={load} />
        </section>
      </div>

      {statsOpen && (
        <div className="mt-6 border-t xl:mt-0 xl:border-t-0">{stats}</div>
      )}
    </div>
  );
}
