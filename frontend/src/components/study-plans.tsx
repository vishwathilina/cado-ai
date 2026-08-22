"use client";

import {
  Add01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  PencilEdit02Icon,
  PlayCircleIcon,
  PauseCircleIcon,
  SparklesIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { FormEvent, Fragment, PointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DatePicker } from "@/components/date-calendar";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api";
import { isoDate } from "@/lib/dates";

export type PlanTask = {
  id: string;
  title: string;
  due_date: string;
  minutes: number;
  completed: boolean;
  position?: number;
};

export type StudyPlan = {
  id: string;
  title: string;
  start_date?: string | null;
  created_at?: string;
  tasks: PlanTask[];
};

type Session = {
  taskId: string;
  startedAt: number;
  durationMs: number;
};

export { isoDate };

function dueLabel(value: string) {
  const [year, month, day] = isoDate(value).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function clock(value: number) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function remain(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function playSound(src: "/event.mp3" | "/luxury.mp3") {
  const audio = new Audio(src);
  audio.volume = 0.85;
  void audio.play().catch(() => undefined);
}

export function StudyPlans({
  plans,
  selectedDate,
  onChange,
}: {
  plans: StudyPlan[];
  selectedDate: string;
  onChange: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(plans[0]?.id ?? "");
  const [creating, setCreating] = useState<"generate" | "blank" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newMinutes, setNewMinutes] = useState(20);
  const [newDate, setNewDate] = useState(selectedDate);
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [stopAsk, setStopAsk] = useState<{ kind: "stop" } | { kind: "switch"; task: PlanTask } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [insertIndex, setInsertIndex] = useState(0);
  const [order, setOrder] = useState<string[]>([]);
  const chimed = useRef(false);
  const dragIdRef = useRef<string | null>(null);
  const orderRef = useRef<string[]>([]);
  const insertRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<StudyPlan | null>(null);
  const runRef = useRef(async (_action: () => Promise<void>) => {});
  const dragGeom = useRef<{ width: number; offsetX: number; offsetY: number; originX: number; originY: number } | null>(null);
  const flipFrom = useRef<Map<string, number> | null>(null);
  const handleMove = useRef((_event: globalThis.PointerEvent) => {});
  const handleUp = useRef(() => {});
  const onWinMove = useRef((event: globalThis.PointerEvent) => {
    event.preventDefault();
    handleMove.current(event);
  }).current;
  const onWinUp = useRef(() => {
    handleUp.current();
  }).current;

  useEffect(() => {
    if (!plans.some((plan) => plan.id === selectedId)) {
      setSelectedId(plans[0]?.id ?? "");
    }
  }, [plans, selectedId]);

  useEffect(() => {
    setNewDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!session) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session) {
      chimed.current = false;
      return;
    }
    const left = session.startedAt + session.durationMs - now;
    if (left > 0 || chimed.current) return;
    chimed.current = true;
    playSound("/luxury.mp3");
  }, [session, now]);

  const plan = useMemo(
    () => plans.find((item) => item.id === selectedId) ?? null,
    [plans, selectedId],
  );
  planRef.current = plan;
  const done = plan?.tasks.filter((task) => task.completed).length ?? 0;
  const tasks = useMemo(() => {
    if (!plan) return [];
    const lookup = new Map(plan.tasks.map((task) => [task.id, task]));
    const ids = order.length ? order : plan.tasks.map((task) => task.id);
    const listed = ids.map((id) => lookup.get(id)).filter((task): task is PlanTask => Boolean(task));
    const missing = plan.tasks.filter((task) => !ids.includes(task.id));
    return [...listed, ...missing];
  }, [plan, order]);

  useEffect(() => {
    if (!plan) {
      setOrder([]);
      orderRef.current = [];
      return;
    }
    if (dragIdRef.current) return;
    const ids = plan.tasks.map((task) => task.id);
    setOrder(ids);
    orderRef.current = ids;
  }, [plan]);

  useLayoutEffect(() => {
    const from = flipFrom.current;
    const list = listRef.current;
    if (!from || !list) return;
    flipFrom.current = null;
    for (const el of list.querySelectorAll<HTMLElement>("[data-task-id]")) {
      const id = el.dataset.taskId;
      if (!id) continue;
      const start = from.get(id);
      if (start == null) continue;
      const dy = start - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) continue;
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      el.offsetHeight;
      el.style.transition = "transform .2s ease";
      el.style.transform = "";
    }
  }, [insertIndex, dragId]);

  useLayoutEffect(() => {
    const float = floatRef.current;
    const geom = dragGeom.current;
    if (!float || !geom || !dragId) return;
    float.style.width = `${geom.width}px`;
    float.style.transform = `translate3d(${geom.originX}px, ${geom.originY}px, 0) rotate(1.2deg) scale(1.03)`;
  }, [dragId]);

  useEffect(() => () => {
    window.removeEventListener("pointermove", onWinMove);
    window.removeEventListener("pointerup", onWinUp);
    window.removeEventListener("pointercancel", onWinUp);
    document.documentElement.classList.remove("plan-dragging");
  }, [onWinMove, onWinUp]);

  async function run(action: () => Promise<void>) {
    setError("");
    setSaving(true);
    try {
      await action();
      await onChange();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update that plan");
    } finally {
      setSaving(false);
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      const created = await api<StudyPlan>("/study-plans", {
        method: "POST",
        body: JSON.stringify({
          goal: form.get("goal"),
          minutes_per_day: Number(form.get("minutes")),
          start_date: form.get("start_date") || selectedDate,
          exam_date: form.get("exam_date") || null,
        }),
      });
      setSelectedId(created.id);
      setCreating(null);
    });
  }

  async function createBlank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      const created = await api<StudyPlan>("/study-plans/blank", {
        method: "POST",
        body: JSON.stringify({ title: form.get("title"), start_date: form.get("start_date") || selectedDate }),
      });
      setSelectedId(created.id);
      setCreating(null);
    });
  }

  async function saveTitle() {
    if (!plan) return;
    const title = titleDraft.trim();
    setEditingTitle(false);
    if (!title || title === plan.title) return;
    await run(() =>
      api(`/study-plans/${plan.id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
    );
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan || !newTask.trim()) return;
    await run(async () => {
      await api(`/study-plans/${plan.id}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: newTask.trim(), minutes: newMinutes, due_date: newDate }),
      });
      setNewTask("");
    });
  }

  async function saveTask(task: PlanTask) {
    const title = taskDraft.trim();
    setEditingTask(null);
    if (!title || title === task.title) return;
    await run(() =>
      api(`/study-tasks/${task.id}`, { method: "PUT", body: JSON.stringify({ title }) }),
    );
  }

  function startTask(task: PlanTask) {
    chimed.current = false;
    setStopAsk(null);
    setSession({
      taskId: task.id,
      startedAt: Date.now(),
      durationMs: Math.max(1, task.minutes) * 60 * 1000,
    });
    playSound("/event.mp3");
  }

  function requestStop() {
    if (!session) return;
    setStopAsk({ kind: "stop" });
  }

  function requestStart(task: PlanTask) {
    if (session && session.taskId !== task.id) {
      setStopAsk({ kind: "switch", task });
      return;
    }
    startTask(task);
  }

  function confirmStop() {
    if (stopAsk?.kind === "switch") {
      startTask(stopAsk.task);
      return;
    }
    setSession(null);
    setStopAsk(null);
  }

  async function addTime(task: PlanTask, extra: number) {
    if (!session) return;
    chimed.current = false;
    setSession({ ...session, durationMs: session.durationMs + extra * 60 * 1000 });
    await run(() =>
      api(`/study-tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({ minutes: task.minutes + extra }),
      }),
    );
  }

  async function completeTask(task: PlanTask) {
    if (!chimed.current) playSound("/luxury.mp3");
    chimed.current = true;
    if (!task.completed) {
      await run(() => api(`/study-tasks/${task.id}`, { method: "PATCH" }));
    }
    setSession(null);
    setStopAsk(null);
  }

  function measureInsert(clientY: number) {
    const list = listRef.current;
    if (!list) return insertRef.current;
    const rows = [...list.querySelectorAll<HTMLElement>("[data-task-id]")];
    for (let i = 0; i < rows.length; i += 1) {
      const rect = rows[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return rows.length;
  }

  function applyInsert(next: number) {
    if (next === insertRef.current) return;
    const list = listRef.current;
    if (list) {
      flipFrom.current = new Map(
        [...list.querySelectorAll<HTMLElement>("[data-task-id]")].map((el) => [
          el.dataset.taskId ?? "",
          el.getBoundingClientRect().top,
        ]),
      );
    }
    insertRef.current = next;
    setInsertIndex(next);
  }

  function placeFloat(clientX: number, clientY: number) {
    const float = floatRef.current;
    const geom = dragGeom.current;
    if (!float || !geom) return;
    float.style.transform = `translate3d(${clientX - geom.offsetX}px, ${clientY - geom.offsetY}px, 0) rotate(1.2deg) scale(1.03)`;
  }

  function stopListening() {
    window.removeEventListener("pointermove", onWinMove);
    window.removeEventListener("pointerup", onWinUp);
    window.removeEventListener("pointercancel", onWinUp);
    document.documentElement.classList.remove("plan-dragging");
  }

  function beginDrag(taskId: string, event: PointerEvent<HTMLElement>) {
    if (session?.taskId === taskId || dragIdRef.current) return;
    const row = event.currentTarget.closest("[data-task-id]");
    if (!(row instanceof HTMLElement)) return;
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    dragGeom.current = {
      width: rect.width,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      originX: rect.left,
      originY: rect.top,
    };
    const from = tasks.findIndex((task) => task.id === taskId);
    const list = listRef.current;
    if (list) {
      flipFrom.current = new Map(
        [...list.querySelectorAll<HTMLElement>("[data-task-id]")]
          .filter((el) => el.dataset.taskId !== taskId)
          .map((el) => [el.dataset.taskId ?? "", el.getBoundingClientRect().top]),
      );
    }
    dragIdRef.current = taskId;
    insertRef.current = Math.max(0, from);
    setInsertIndex(insertRef.current);
    setDragId(taskId);
    document.documentElement.classList.add("plan-dragging");
    window.addEventListener("pointermove", onWinMove, { passive: false });
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinUp);
  }

  async function endDrag() {
    const id = dragIdRef.current;
    const insertAt = insertRef.current;
    stopListening();
    dragIdRef.current = null;
    dragGeom.current = null;
    setDragId(null);
    if (!id) return;
    const others = orderRef.current.filter((taskId) => taskId !== id);
    const ids = [...others.slice(0, insertAt), id, ...others.slice(insertAt)];
    orderRef.current = ids;
    setOrder(ids);
    const current = planRef.current;
    if (!current) return;
    const original = current.tasks.map((task) => task.id);
    if (ids.length !== original.length || ids.every((taskId, index) => taskId === original[index])) return;
    await runRef.current(() =>
      api(`/study-plans/${current.id}/tasks/reorder`, {
        method: "PUT",
        body: JSON.stringify({ task_ids: ids }),
      }),
    );
  }

  handleMove.current = (event) => {
    if (!dragIdRef.current) return;
    placeFloat(event.clientX, event.clientY);
    applyInsert(measureInsert(event.clientY));
  };
  handleUp.current = () => {
    void endDrag();
  };
  runRef.current = run;

  const visibleTasks = dragId ? tasks.filter((task) => task.id !== dragId) : tasks;
  const floatTask = dragId ? tasks.find((task) => task.id === dragId) ?? null : null;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold">Plans</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCreating(creating === "blank" ? null : "blank")} className="btn-secondary py-2 text-sm">
            <Icon icon={Add01Icon} size={14} /> New plan
          </button>
          <button onClick={() => setCreating(creating === "generate" ? null : "generate")} className="btn-primary py-2 text-sm">
            <Icon icon={SparklesIcon} size={14} /> Generate
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>}

      {creating === "generate" && (
        <form onSubmit={generate} className="card mb-4 grid gap-3 p-4 md:grid-cols-2">
          <label className="text-sm font-semibold md:col-span-2">Goal
            <input name="goal" required placeholder="e.g. Master cell biology before Friday" className="field mt-2" />
          </label>
          <div className="text-sm font-semibold">Start date
            <DatePicker name="start_date" defaultValue={selectedDate} className="mt-2" />
          </div>
          <div className="text-sm font-semibold">Exam date <span className="muted font-medium">(optional)</span>
            <DatePicker name="exam_date" allowEmpty placeholder="Optional" className="mt-2" />
          </div>
          <label className="text-sm font-semibold">Minutes / day
            <input name="minutes" type="number" min={10} max={240} defaultValue={30} className="field mt-2" />
          </label>
          <button disabled={saving} className="btn-primary self-end">{saving ? "Generating…" : "Create plan"}</button>
        </form>
      )}

      {creating === "blank" && (
        <form onSubmit={createBlank} className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_11rem_auto]">
          <label className="text-sm font-semibold">Plan name
            <input name="title" required placeholder="e.g. Midterm week" className="field mt-2" />
          </label>
          <div className="text-sm font-semibold">Start date
            <DatePicker name="start_date" defaultValue={selectedDate} className="mt-2" />
          </div>
          <button disabled={saving} className="btn-primary self-end">{saving ? "Saving…" : "Create empty plan"}</button>
        </form>
      )}

      {plans.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {plans.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                item.id === selectedId ? "bg-[#1c1c1c] text-white" : "bg-[var(--surface)] text-[var(--muted)]"
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
      )}

      {!plan ? (
        <div className="card p-6">
          <p className="muted text-sm">Generate a plan or start a blank one, then add tasks.</p>
        </div>
      ) : (
        <div className="card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") setEditingTitle(false);
                }}
                className="field max-w-md text-lg font-semibold"
              />
            ) : (
              <button
                onClick={() => {
                  setTitleDraft(plan.title);
                  setEditingTitle(true);
                }}
                className="flex items-center gap-2 text-left text-lg font-semibold"
              >
                {plan.title}
                <Icon icon={PencilEdit02Icon} size={14} className="text-[var(--muted)]" />
              </button>
            )}
            <button
              onClick={() => run(() => api(`/study-plans/${plan.id}`, { method: "DELETE" }))}
              className="nav-rail-item"
              aria-label="Delete plan"
            >
              <Icon icon={Delete02Icon} size={16} />
            </button>
          </div>

          {plan.tasks.length > 0 && (
            <p className="muted mb-3 text-xs font-semibold">
              {done} of {plan.tasks.length} complete
            </p>
          )}

          <div className={`plan-task-list ${dragId ? "is-sorting" : ""}`} ref={listRef}>
            {visibleTasks.map((task, index) => {
              const active = session?.taskId === task.id;
              const endsAt = active ? session.startedAt + session.durationMs : 0;
              const left = active ? endsAt - now : 0;
              const timesUp = active && left <= 0;
              const progress = active
                ? Math.min(100, ((now - session.startedAt) / session.durationMs) * 100)
                : 0;
              const asking = Boolean(active && stopAsk);
              return (
                <Fragment key={task.id}>
                  {dragId && insertIndex === index && (
                    <div className="plan-drop" aria-hidden>
                      <span />
                    </div>
                  )}
                  <div
                    data-task-id={task.id}
                    className={`plan-task ${active ? "is-active" : ""} ${task.completed ? "is-done" : ""}`}
                  >
                    <div className="plan-task-row">
                      {!active && (
                        <span
                          role="button"
                          tabIndex={0}
                          className="task-grip"
                          aria-label="Drag to reorder"
                          onPointerDown={(event) => beginDrag(task.id, event)}
                        >
                          <Icon icon={DragDropVerticalIcon} size={16} />
                        </span>
                      )}
                      <button
                        onClick={() => run(() => api(`/study-tasks/${task.id}`, { method: "PATCH" }))}
                        className={`plan-check ${task.completed ? "is-on" : ""}`}
                        aria-label={task.completed ? "Mark as not done" : "Mark as done"}
                      >
                        {task.completed && <Icon icon={Tick02Icon} size={14} />}
                      </button>
                      {editingTask === task.id ? (
                        <input
                          autoFocus
                          value={taskDraft}
                          onChange={(event) => setTaskDraft(event.target.value)}
                          onBlur={() => saveTask(task)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") event.currentTarget.blur();
                            if (event.key === "Escape") setEditingTask(null);
                          }}
                          className="field min-w-0 flex-1 py-2"
                        />
                      ) : (
                        <div className="min-w-0 flex-1">
                          <p className={`plan-task-title ${isoDate(task.due_date) === selectedDate ? "is-today" : ""}`}>
                            {task.title}
                          </p>
                          <p className="plan-task-meta">{dueLabel(task.due_date)} · {task.minutes} min</p>
                        </div>
                      )}
                      <div className="plan-task-actions">
                        {!task.completed && (
                          <button
                            onClick={() => (active ? requestStop() : requestStart(task))}
                            aria-label={active ? "Stop timer" : "Start timer"}
                          >
                            <Icon icon={active ? PauseCircleIcon : PlayCircleIcon} size={20} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingTask(task.id);
                            setTaskDraft(task.title);
                          }}
                          aria-label="Edit task"
                        >
                          <Icon icon={PencilEdit02Icon} size={16} />
                        </button>
                        <button
                          onClick={() => run(() => api(`/study-tasks/${task.id}`, { method: "DELETE" }))}
                          aria-label="Delete task"
                        >
                          <Icon icon={Delete02Icon} size={16} />
                        </button>
                      </div>
                    </div>
                    {active && session && (
                      <div className="plan-session">
                        <p className="plan-session-time">{timesUp ? "Time’s up" : remain(left)}</p>
                        {!timesUp && <p className="plan-session-label">left</p>}
                        <div className="plan-session-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timesUp ? 100 : progress)}>
                          <span style={{ width: `${timesUp ? 100 : Math.max(progress, 4)}%` }} />
                        </div>
                        <div className="plan-session-clocks">
                          <span>{clock(session.startedAt)}</span>
                          <span>{clock(endsAt)}</span>
                        </div>
                        {asking && stopAsk ? (
                          <div className="plan-session-ask">
                            <p className="text-sm font-semibold">
                              {stopAsk.kind === "switch" ? "Start the next task instead?" : "Stop this timer?"}
                            </p>
                            <div className="mt-3 flex gap-2">
                              <button type="button" className="btn-secondary flex-1 py-2 text-sm" onClick={() => setStopAsk(null)}>
                                Keep going
                              </button>
                              <button type="button" className="btn-primary flex-1 py-2 text-sm" onClick={confirmStop}>
                                Stop
                              </button>
                            </div>
                          </div>
                        ) : timesUp ? (
                          <div className="plan-session-ask">
                            <p className="text-sm font-semibold">Need more time, or complete it?</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button onClick={() => addTime(task, 5)} className="btn-secondary py-2 text-sm">+5 min</button>
                              <button onClick={() => addTime(task, 10)} className="btn-secondary py-2 text-sm">+10 min</button>
                              <button onClick={() => completeTask(task)} className="btn-primary min-w-[8rem] flex-1 py-2 text-sm">
                                <Icon icon={Tick02Icon} size={14} /> Complete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => completeTask(task)} className="btn-secondary w-full py-2.5 text-sm">
                            <Icon icon={Tick02Icon} size={14} /> Complete now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </Fragment>
              );
            })}
            {dragId && insertIndex === visibleTasks.length && (
              <div className="plan-drop" aria-hidden>
                <span />
              </div>
            )}
            {floatTask && (
              <div
                ref={floatRef}
                className={`plan-task is-float ${floatTask.completed ? "is-done" : ""}`}
                aria-hidden
              >
                <div className="plan-task-row">
                  <span className="task-grip">
                    <Icon icon={DragDropVerticalIcon} size={16} />
                  </span>
                  <span className={`plan-check ${floatTask.completed ? "is-on" : ""}`}>
                    {floatTask.completed && <Icon icon={Tick02Icon} size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="plan-task-title">{floatTask.title}</p>
                    <p className="plan-task-meta">{dueLabel(floatTask.due_date)} · {floatTask.minutes} min</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={addTask} className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
            <input
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              placeholder="Add a task"
              className="field min-w-[12rem] flex-1 py-2"
            />
            <DatePicker value={newDate} onChange={setNewDate} className="w-[12.5rem]" />
            <input
              type="number"
              min={5}
              max={240}
              value={newMinutes}
              onChange={(event) => setNewMinutes(Number(event.target.value))}
              className="field w-24 py-2"
              aria-label="Minutes"
            />
            <button disabled={saving || !newTask.trim()} className="btn-secondary py-2 text-sm">
              <Icon icon={Add01Icon} size={14} /> Add
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
