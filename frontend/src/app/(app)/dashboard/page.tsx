"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  GlobalIcon,
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
  studied_today_minutes: number;
  study_plan: StudyPlan & { id: string | null };
  study_plans: StudyPlan[];
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
  const [selectedDate, setSelectedDate] = useState(() => isoDate());
  const [newAchievement, setNewAchievement] = useState("");
  const [countdownTitle, setCountdownTitle] = useState("");
  const [countdownDate, setCountdownDate] = useState(() => isoDate());
  const [now, setNow] = useState(() => Date.now());
  const [featuredId, setFeaturedId] = useState<string | null>(null);

  async function load() {
    try {
      const payload = await api<Dashboard>("/dashboard");
      setData((current) => (current ? { ...payload, study_plans: current.study_plans } : payload));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load dashboard");
    }
  }

  function applyPlans(update: (plans: StudyPlan[]) => StudyPlan[]) {
    setData((current) => {
      if (!current) return current;
      return { ...current, study_plans: update(current.study_plans) };
    });
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
  const featured =
    visible.find((set) => set.id === featuredId) ??
    visible[0] ??
    null;
  const days = useMemo(() => weekDays(), []);
  const weekStart = isoDate(days[0]);
  const weekEnd = isoDate(days[6]);
  const weekTasks = useMemo(
    () =>
      (data?.study_plans ?? [])
        .flatMap((plan) => plan.tasks)
        .filter((task) => {
          const due = isoDate(task.due_date);
          return due >= weekStart && due <= weekEnd;
        }),
    [data, weekStart, weekEnd],
  );
  const weekDone = weekTasks.filter((task) => task.completed).length;
  const weekPct = weekTasks.length ? Math.round((weekDone / weekTasks.length) * 100) : 0;
  const quizHref = nextSet && nextSet.question_count > 0 ? `/quiz/${nextSet.id}` : nextSet ? `/learn/${nextSet.id}` : "/upload";

  useEffect(() => {
    setPage(0);
  }, [query]);

  useEffect(() => {
    if (!visible.length) {
      setFeaturedId(null);
      return;
    }
    if (!featuredId || !visible.some((set) => set.id === featuredId)) {
      setFeaturedId(visible[0].id);
    }
  }, [visible, featuredId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (error && !data) return <div className="dash-scene"><div className="dash-page"><div className="glass-panel p-6 text-[var(--danger)]">{error}</div></div></div>;
  if (!data) {
    return (
      <div className="dash-scene">
        <div className="dash-page dash-grid">
          <div className="dash-primary animate-pulse">
            <div className="glass-panel dash-continue h-44 rounded-3xl" />
            <div className="glass-panel dash-plan h-64 rounded-3xl" />
          </div>
          <div className="glass-panel dash-aside hidden h-80 rounded-3xl lg:block" />
        </div>
      </div>
    );
  }

  const firstName = data.name.split(" ")[0];

  const stats = (
    <aside className="glass-panel dash-side dash-aside" id="dash-stats">
      <div className="dash-side-head">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f3803b] text-xs font-semibold text-white">
            {initials(data.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data.name}</p>
            <p className="muted truncate text-xs">{data.streak} day streak · {data.accuracy}% accuracy</p>
          </div>
        </div>
      </div>

      <div className="dash-side-body">
        <div className="dash-side-section">
          <p className="mb-3 text-sm font-semibold">{data.weak_topics.length ? "Needs review" : "Your stats"}</p>
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

        <div className="dash-side-section">
          <p className="mb-3 text-sm font-semibold">Countdowns</p>
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
                      void load();
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted mb-3 text-xs">Track an exam or deadline.</p>
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
                void load();
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

        <div className="dash-side-section">
          <p className="mb-3 text-sm font-semibold">Progress</p>
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="muted">This week</span>
                <span className="font-medium tabular-nums">{weekPct}%</span>
              </div>
              {weekTasks.length ? (
                <ProgressBar value={weekPct} />
              ) : (
                <p className="muted text-xs">Plan tasks will count toward this week.</p>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="muted">This month</span>
                <span className="font-medium tabular-nums">{monthPct}%</span>
              </div>
              {monthTasks.length ? (
                <ProgressBar value={monthPct} />
              ) : (
                <p className="muted text-xs">Plan tasks will count toward this month.</p>
              )}
            </div>
          </div>
        </div>

        <div className="dash-side-section">
          <p className="mb-3 text-sm font-semibold">Wins</p>
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
                void load();
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
                      void load();
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted text-xs">Log a milestone for this month.</p>
          )}
        </div>
      </div>
    </aside>
  );

  const featuredHref =
    featured && featured.question_count > 0 ? `/quiz/${featured.id}` : featured ? `/learn/${featured.id}` : "/upload";
  const featuredTotal = featured ? featured.last_total || featured.question_count : 0;
  const featuredDone = featured?.last_score ?? 0;
  const featuredProgress =
    featuredTotal > 0 ? `${featuredDone}/${featuredTotal} answered` : "Ready to start";

  return (
    <div className="dash-scene min-h-full">
      <div className="dash-page">
        <header className="dash-toolbar">
          <div className="dash-toolbar-title min-w-0">
            <p className="muted text-sm font-medium">Today</p>
            <h1>Hi, {firstName}</h1>
          </div>
          <div className="dash-search-wrap order-last w-full sm:order-none">
            <label className="relative block">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--muted)]">
                <Icon icon={Search01Icon} size={16} />
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your tests"
                className="dash-search-glass"
              />
            </label>
          </div>
          <div className="dash-toolbar-actions">
            <Link href={quizHref} className="btn-primary py-2 text-sm">
              Take quiz
            </Link>
          </div>
        </header>

        <div className="dash-grid">
          <div className="dash-primary">
            <section className="glass-panel dash-continue p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="min-w-0 text-lg font-semibold tracking-tight">Continue studying</h2>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                    disabled={page === 0}
                    className="dash-icon-btn"
                    aria-label="Previous sets"
                  >
                    <Icon icon={ArrowLeft01Icon} size={16} />
                  </button>
                  <button
                    onClick={() => setPage((value) => Math.min(maxPage, value + 1))}
                    disabled={page >= maxPage}
                    className="dash-icon-btn"
                    aria-label="Next sets"
                  >
                    <Icon icon={ArrowRight01Icon} size={16} />
                  </button>
                </div>
              </div>

              {visible.length ? (
                <>
                  <div className="dash-chips">
                    {visible.map((set) => (
                      <button
                        key={set.id}
                        type="button"
                        onClick={() => setFeaturedId(set.id)}
                        className={`glass-chip ${featured?.id === set.id ? "is-active" : ""}`}
                      >
                        <Icon icon={GlobalIcon} size={14} />
                        <span className="truncate">{set.title}</span>
                      </button>
                    ))}
                  </div>

                  {featured && (
                    <FadeIn className="dash-featured">
                      <article>
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-base font-semibold leading-snug">{featured.title}</h3>
                            <p className="muted mt-1 text-xs">
                              {featuredProgress} · {featured.language || "Study set"}
                            </p>
                          </div>
                          <details className="relative shrink-0">
                            <summary className="flex cursor-pointer list-none text-[var(--muted)] [&::-webkit-details-marker]:hidden">
                              <Icon icon={MoreHorizontalIcon} size={16} />
                            </summary>
                            <div className="absolute right-0 z-10 mt-1 w-28 overflow-hidden rounded-xl border bg-[var(--surface)] py-1 text-sm shadow-sm">
                              <Link href={`/learn/${featured.id}`} className="block px-3 py-1.5 hover:bg-[var(--surface-2)]">Learn</Link>
                              {featured.question_count > 0 && (
                                <Link href={`/quiz/${featured.id}`} className="block px-3 py-1.5 hover:bg-[var(--surface-2)]">Quiz</Link>
                              )}
                            </div>
                          </details>
                        </div>
                        <p className="muted text-sm leading-relaxed">
                          {featured.question_count > 0
                            ? `${featured.question_count} questions ready. Pick up where you left off or run the quiz again.`
                            : "Open learn mode for explanations and flashcards from your uploaded notes."}
                        </p>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className="muted text-xs">
                            Added {new Date(featured.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                          </p>
                          <Link href={featuredHref} className="btn-primary py-2 text-sm">
                            {featured.question_count > 0 ? "Start quiz" : "Open learn"}
                          </Link>
                        </div>
                      </article>
                    </FadeIn>
                  )}
                </>
              ) : (
                <div className="pt-2">
                  <p className="muted mb-4 text-sm">
                    {query ? "No sets match that search." : "Upload notes to get explanations, flashcards, and a quiz."}
                  </p>
                  <Link href="/upload" className="btn-primary">Upload notes</Link>
                </div>
              )}
            </section>

            <section className="glass-panel dash-plan p-5 md:p-6">
              <div className="dash-plan-head">
                <h2 className="text-lg font-semibold tracking-tight">Study plan</h2>
                <div>
                  <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
                      <span key={`${label}-${index}`} className="grid w-7 place-items-center">{label}</span>
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
              <StudyPlans
                plans={data.study_plans}
                selectedDate={selectedDate}
                studiedTodayMinutes={data.studied_today_minutes ?? 0}
                onChange={load}
                onPlansChange={applyPlans}
              />
            </section>
          </div>

          {stats}
        </div>
      </div>
    </div>
  );
}
