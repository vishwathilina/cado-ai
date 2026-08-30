"use client";

import {
  Add01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
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
  note?: string | null;
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

const SORT_KEY = "cado-plan-sort";
const DATE_ORDER_KEY = "cado-plan-date-order";
type SortMode = "plan" | "date";
type DatedTask = PlanTask & { planTitle: string };

function readSort(): SortMode {
  if (typeof window === "undefined") return "plan";
  return window.localStorage.getItem(SORT_KEY) === "date" ? "date" : "plan";
}

function readDateOrder(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DATE_ORDER_KEY) || "{}") as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, string[]] =>
        Array.isArray(entry[1]) && entry[1].every((id) => typeof id === "string"),
      ),
    );
  } catch {
    return {};
  }
}

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

function formatHoursMinutes(minutes: number) {
  const hours = Math.floor(Math.max(0, minutes) / 60);
  const mins = Math.max(0, minutes) % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function untilMidnight(dateStr: string, now: number) {
  const [year, month, day] = isoDate(dateStr).split("-").map(Number);
  const end = new Date(year, month - 1, day + 1).getTime();
  const left = end - now;
  if (left <= 0) return "ended";
  const totalMin = Math.floor(left / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return `${hours} h ${minutes}min`;
}

function dayElapsedPct(dateStr: string, now: number) {
  const [year, month, day] = isoDate(dateStr).split("-").map(Number);
  const start = new Date(year, month - 1, day).getTime();
  const end = new Date(year, month - 1, day + 1).getTime();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function DayMeta({
  date,
  total,
  doneCount,
  planned,
}: {
  date: string;
  total: number;
  doneCount: number;
  planned: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const isToday = isoDate(date) === isoDate(new Date(now));
  useEffect(() => {
    if (!isToday) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isToday]);
  const pct = dayElapsedPct(date, now);
  return (
    <>
      <p className="plan-day-meta">
        {total} {total === 1 ? "task" : "tasks"}
        {` · ${doneCount} of ${total} done`}
        {` · ${untilMidnight(date, now)}`}
        {` · ${formatHoursMinutes(planned)} planned`}
      </p>
      {isToday && (
        <div className="plan-day-fill">
          <div
            className="plan-day-fill-track"
            role="progressbar"
            aria-label="Day elapsed"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="plan-day-fill-pct">{pct}%</span>
        </div>
      )}
    </>
  );
}

function leftoverOnDay(tasks: PlanTask[], today: string) {
  return tasks.filter((task) => !task.completed && isoDate(task.due_date) < today);
}

function playSound(src: "/event.mp3" | "/luxury.mp3") {
  const audio = new Audio(src);
  audio.volume = 0.85;
  void audio.play().catch(() => undefined);
}

function dayStats(tasks: PlanTask[]) {
  const total = tasks.length;
  const doneCount = tasks.filter((task) => task.completed).length;
  const planned = tasks.reduce((sum, task) => sum + task.minutes, 0);
  return { total, doneCount, planned };
}

export function StudyPlans({
  plans,
  selectedDate,
  studiedTodayMinutes = 0,
  onChange,
  onPlansChange,
}: {
  plans: StudyPlan[];
  selectedDate: string;
  studiedTodayMinutes?: number;
  onChange: () => Promise<void>;
  onPlansChange: (update: (plans: StudyPlan[]) => StudyPlan[]) => void;
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
  const [sessionNote, setSessionNote] = useState("");
  const [studiedMinutes, setStudiedMinutes] = useState(studiedTodayMinutes);
  const [now, setNow] = useState(() => Date.now());
  const [sortBy, setSortBy] = useState<SortMode>("plan");
  const [dateOrder, setDateOrder] = useState<Record<string, string[]>>({});
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [dayTask, setDayTask] = useState("");
  const [dayMinutes, setDayMinutes] = useState(20);
  const [openEnded, setOpenEnded] = useState<Record<string, boolean>>({});
  const [stopAsk, setStopAsk] = useState<{ kind: "stop" } | { kind: "switch"; task: PlanTask } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [insertIndex, setInsertIndex] = useState(0);
  const [order, setOrder] = useState<string[]>([]);
  const chimed = useRef(false);
  const dragIdRef = useRef<string | null>(null);
  const orderRef = useRef<string[]>([]);
  const insertRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const dateListRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const floatRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<StudyPlan | null>(null);
  const dragDateRef = useRef<string | null>(null);
  const dateOrderRef = useRef<Record<string, string[]>>({});
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
    setSortBy(readSort());
    const stored = readDateOrder();
    setDateOrder(stored);
    dateOrderRef.current = stored;
  }, []);

  useEffect(() => {
    if (!plans.some((plan) => plan.id === selectedId)) {
      setSelectedId(plans[0]?.id ?? "");
    }
  }, [plans, selectedId]);

  useEffect(() => {
    setNewDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    setStudiedMinutes(studiedTodayMinutes);
  }, [studiedTodayMinutes]);

  useEffect(() => {
    let active = true;
    api<{ minutes: number }>(`/study-sessions/today?day=${isoDate()}`)
      .then((payload) => {
        if (active) setStudiedMinutes(payload.minutes);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedDate >= isoDate()) return;
    setOpenEnded((current) => {
      if (selectedDate in current) return current;
      return { ...current, [selectedDate]: true };
    });
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
  const dayGroups = useMemo(() => {
    const groups = new Map<string, DatedTask[]>();
    for (const item of plans) {
      for (const task of item.tasks) {
        const date = isoDate(task.due_date);
        const list = groups.get(date) ?? [];
        list.push({ ...task, planTitle: item.title });
        groups.set(date, list);
      }
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, tasks: items }));
  }, [plans]);
  dateOrderRef.current = dateOrder;

  const displayedDays = useMemo(() => {
    const groups = dayGroups.map((group) => {
      const lookup = new Map(group.tasks.map((task) => [task.id, task]));
      const saved = (dateOrder[group.date] ?? []).map((id) => lookup.get(id)).filter((task): task is DatedTask => Boolean(task));
      const missing = group.tasks.filter((task) => !saved.some((item) => item.id === task.id));
      return { date: group.date, tasks: [...saved, ...missing] };
    });
    if (!groups.some((group) => group.date === selectedDate)) {
      groups.push({ date: selectedDate, tasks: [] });
      groups.sort((a, b) => a.date.localeCompare(b.date));
    }
    return groups;
  }, [dayGroups, dateOrder, selectedDate]);

  function chooseSort(next: SortMode) {
    if (next === sortBy) return;
    if (dragIdRef.current) {
      stopListening();
      dragIdRef.current = null;
      dragGeom.current = null;
      dragDateRef.current = null;
      setDragId(null);
    }
    setAddingDate(null);
    setSortBy(next);
    window.localStorage.setItem(SORT_KEY, next);
  }

  function toggleEnded(date: string) {
    const next = !(openEnded[date] ?? false);
    setOpenEnded((current) => ({ ...current, [date]: next }));
    if (!next && addingDate === date) setAddingDate(null);
  }
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

  useEffect(() => {
    if (sortBy !== "date" || dragIdRef.current) return;
    setDateOrder((current) => {
      const next = { ...current };
      let changed = false;
      for (const group of dayGroups) {
        const ids = group.tasks.map((task) => task.id);
        const saved = (next[group.date] ?? []).filter((id) => ids.includes(id));
        const missing = ids.filter((id) => !saved.includes(id));
        const merged = [...saved, ...missing];
        if (merged.join() !== (next[group.date] ?? []).join()) {
          next[group.date] = merged;
          changed = true;
        }
      }
      if (!changed) return current;
      dateOrderRef.current = next;
      window.localStorage.setItem(DATE_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }, [dayGroups, sortBy]);

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

  async function run(action: () => Promise<void>, refresh = false) {
    setError("");
    setSaving(true);
    try {
      await action();
      if (refresh) void onChange();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update that plan");
    } finally {
      setSaving(false);
    }
  }

  function patchPlans(update: (current: StudyPlan[]) => StudyPlan[]) {
    onPlansChange(update);
  }

  function patchTask(taskId: string, patch: Partial<PlanTask>) {
    patchPlans((current) =>
      current.map((item) => ({
        ...item,
        tasks: item.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
      })),
    );
  }

  async function mutate(action: () => Promise<void>, revert: () => void) {
    setError("");
    try {
      await action();
    } catch (reason) {
      revert();
      setError(reason instanceof Error ? reason.message : "Could not update that plan");
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
      patchPlans((current) => [created, ...current.filter((item) => item.id !== created.id)]);
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
      patchPlans((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSelectedId(created.id);
      setCreating(null);
    });
  }

  async function saveTitle() {
    if (!plan) return;
    const title = titleDraft.trim();
    setEditingTitle(false);
    if (!title || title === plan.title) return;
    const previous = plan.title;
    patchPlans((current) => current.map((item) => (item.id === plan.id ? { ...item, title } : item)));
    await mutate(
      () => api(`/study-plans/${plan.id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
      () => patchPlans((current) => current.map((item) => (item.id === plan.id ? { ...item, title: previous } : item))),
    );
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan || !newTask.trim()) return;
    await run(async () => {
      const updated = await api<StudyPlan>(`/study-plans/${plan.id}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: newTask.trim(), minutes: newMinutes, due_date: newDate }),
      });
      patchPlans((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNewTask("");
    });
  }

  async function addTaskOnDate(event: FormEvent<HTMLFormElement>, date: string) {
    event.preventDefault();
    if (!plan || !dayTask.trim()) return;
    await run(async () => {
      const updated = await api<StudyPlan>(`/study-plans/${plan.id}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: dayTask.trim(), minutes: dayMinutes, due_date: date }),
      });
      patchPlans((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDayTask("");
      setAddingDate(null);
    });
  }

  async function moveTasksToToday(items: PlanTask[]) {
    const today = isoDate();
    const leftover = leftoverOnDay(items, today);
    if (!leftover.length) return;
    const ids = leftover.map((task) => task.id);
    const previous = leftover.map((task) => ({ id: task.id, due_date: task.due_date }));
    leftover.forEach((task) => patchTask(task.id, { due_date: today }));
    setDateOrder((current) => {
      const next = { ...current };
      for (const date of Object.keys(next)) {
        next[date] = next[date].filter((id) => !ids.includes(id));
      }
      next[today] = [...ids, ...(next[today] ?? []).filter((id) => !ids.includes(id))];
      dateOrderRef.current = next;
      window.localStorage.setItem(DATE_ORDER_KEY, JSON.stringify(next));
      return next;
    });
    await mutate(
      () =>
        Promise.all(
          leftover.map((task) =>
            api(`/study-tasks/${task.id}`, {
              method: "PUT",
              body: JSON.stringify({ due_date: today }),
            }),
          ),
        ).then(() => undefined),
      () => previous.forEach((task) => patchTask(task.id, { due_date: task.due_date })),
    );
  }

  async function saveTask(task: PlanTask) {
    const title = taskDraft.trim();
    setEditingTask(null);
    if (!title || title === task.title) return;
    const previous = task.title;
    patchTask(task.id, { title });
    await mutate(
      () => api(`/study-tasks/${task.id}`, { method: "PUT", body: JSON.stringify({ title }) }),
      () => patchTask(task.id, { title: previous }),
    );
  }

  function startTask(task: PlanTask) {
    chimed.current = false;
    setStopAsk(null);
    setSessionNote("");
    setSession({
      taskId: task.id,
      startedAt: Date.now(),
      durationMs: Math.max(1, task.minutes) * 60 * 1000,
    });
    playSound("/event.mp3");
  }

  async function saveSession(note: string) {
    if (!session) return;
    const endedAt = Date.now();
    const guess = Math.max(0, Math.round((endedAt - session.startedAt) / 60000));
    const text = note.trim();
    if (text) patchTask(session.taskId, { note: text });
    setStudiedMinutes((current) => current + guess);
    try {
      const saved = await api<{ minutes: number }>("/study-sessions", {
        method: "POST",
        body: JSON.stringify({
          task_id: session.taskId,
          started_at: new Date(session.startedAt).toISOString(),
          ended_at: new Date(endedAt).toISOString(),
          day: isoDate(),
          note: note.trim() || null,
        }),
      });
      setStudiedMinutes((current) => current - guess + saved.minutes);
    } catch (reason) {
      setStudiedMinutes((current) => Math.max(0, current - guess));
      setError(reason instanceof Error ? reason.message : "Could not save study time");
    }
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

  async function confirmStop() {
    const next = stopAsk?.kind === "switch" ? stopAsk.task : null;
    const note = sessionNote;
    await saveSession(note);
    setSession(null);
    setStopAsk(null);
    setSessionNote("");
    if (next) startTask(next);
  }

  async function addTime(task: PlanTask, extra: number) {
    if (!session) return;
    chimed.current = false;
    setSession({ ...session, durationMs: session.durationMs + extra * 60 * 1000 });
    const minutes = task.minutes + extra;
    patchTask(task.id, { minutes });
    await mutate(
      () => api(`/study-tasks/${task.id}`, { method: "PUT", body: JSON.stringify({ minutes }) }),
      () => patchTask(task.id, { minutes: task.minutes }),
    );
  }

  async function completeTask(task: PlanTask) {
    if (!chimed.current) playSound("/luxury.mp3");
    chimed.current = true;
    if (session?.taskId === task.id) {
      await saveSession(sessionNote);
    }
    if (!task.completed) {
      patchTask(task.id, { completed: true });
      await mutate(
        () => api(`/study-tasks/${task.id}`, { method: "PATCH" }),
        () => patchTask(task.id, { completed: false }),
      );
    }
    setSession(null);
    setStopAsk(null);
    setSessionNote("");
  }

  function toggleTask(task: PlanTask) {
    patchTask(task.id, { completed: !task.completed });
    void mutate(
      () => api(`/study-tasks/${task.id}`, { method: "PATCH" }),
      () => patchTask(task.id, { completed: task.completed }),
    );
  }

  function deleteTask(task: PlanTask) {
    const snapshot = plans;
    patchPlans((current) =>
      current.map((item) => ({
        ...item,
        tasks: item.tasks.filter((itemTask) => itemTask.id !== task.id),
      })),
    );
    void mutate(
      () => api(`/study-tasks/${task.id}`, { method: "DELETE" }),
      () => patchPlans(() => snapshot),
    );
  }

  function deletePlan(planId: string) {
    const snapshot = plans;
    patchPlans((current) => current.filter((item) => item.id !== planId));
    void mutate(
      () => api(`/study-plans/${planId}`, { method: "DELETE" }),
      () => patchPlans(() => snapshot),
    );
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

  function beginDrag(taskId: string, event: PointerEvent<HTMLElement>, date?: string) {
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
    if (date) {
      dragDateRef.current = date;
      listRef.current = dateListRefs.current[date] ?? null;
      const dayIds = displayedDays.find((group) => group.date === date)?.tasks.map((task) => task.id) ?? [];
      const saved = (dateOrderRef.current[date] ?? []).filter((id) => dayIds.includes(id));
      const missing = dayIds.filter((id) => !saved.includes(id));
      orderRef.current = saved.length || missing.length ? [...saved, ...missing] : dayIds;
    } else {
      dragDateRef.current = null;
      orderRef.current = order.length ? order : tasks.map((task) => task.id);
    }
    const from = orderRef.current.findIndex((id) => id === taskId);
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
    const date = dragDateRef.current;
    stopListening();
    dragIdRef.current = null;
    dragGeom.current = null;
    dragDateRef.current = null;
    setDragId(null);
    if (!id) return;
    const others = orderRef.current.filter((taskId) => taskId !== id);
    const ids = [...others.slice(0, insertAt), id, ...others.slice(insertAt)];
    orderRef.current = ids;
    if (date) {
      const next = { ...dateOrderRef.current, [date]: ids };
      dateOrderRef.current = next;
      setDateOrder(next);
      window.localStorage.setItem(DATE_ORDER_KEY, JSON.stringify(next));
      return;
    }
    setOrder(ids);
    const current = planRef.current;
    if (!current) return;
    const original = current.tasks.map((task) => task.id);
    if (ids.length !== original.length || ids.every((taskId, index) => taskId === original[index])) return;
    await mutate(
      () =>
        api(`/study-plans/${current.id}/tasks/reorder`, {
          method: "PUT",
          body: JSON.stringify({ task_ids: ids }),
        }).then(() => undefined),
      () => {
        setOrder(original);
        orderRef.current = original;
      },
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

  const visibleTasks = dragId ? tasks.filter((task) => task.id !== dragId) : tasks;
  const floatTask = dragId
    ? sortBy === "date"
      ? displayedDays.flatMap((group) => group.tasks).find((task) => task.id === dragId) ?? null
      : tasks.find((task) => task.id === dragId) ?? null
    : null;
  const today = isoDate(new Date(now));
  const liveStudied = session ? Math.max(0, Math.floor((now - session.startedAt) / 60000)) : 0;

  function renderTask(
    task: PlanTask,
    index: number,
    options: { canDrag: boolean; meta: string; date?: string; dropActive?: boolean },
  ) {
    const active = session?.taskId === task.id;
    const endsAt = active && session ? session.startedAt + session.durationMs : 0;
    const left = active ? endsAt - now : 0;
    const timesUp = active && left <= 0;
    const progress = active && session
      ? Math.min(100, ((now - session.startedAt) / session.durationMs) * 100)
      : 0;
    const asking = Boolean(active && stopAsk);
    const overdue = leftoverOnDay([task], today).length > 0;
    return (
      <Fragment key={task.id}>
        {options.canDrag && options.dropActive && dragId && insertIndex === index && (
          <div className="plan-drop" aria-hidden>
            <span />
          </div>
        )}
        <div
          data-task-id={task.id}
          className={`plan-task ${active ? "is-active" : ""} ${task.completed ? "is-done" : ""}`}
        >
          <div className="plan-task-row">
            {options.canDrag && !active && (
              <span
                role="button"
                tabIndex={0}
                className="task-grip"
                aria-label="Drag to reorder"
                onPointerDown={(event) => beginDrag(task.id, event, options.date)}
              >
                <Icon icon={DragDropVerticalIcon} size={16} />
              </span>
            )}
            <button
              onClick={() => toggleTask(task)}
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
                <p className="plan-task-meta">{options.meta}</p>
                {task.note ? <p className="plan-task-note">{task.note}</p> : null}
              </div>
            )}
            <div className="plan-task-actions">
              {overdue && (
                <button
                  type="button"
                  className="task-today"
                  disabled={saving}
                  onClick={() => moveTasksToToday([task])}
                  aria-label="Move task to today"
                >
                  Today
                </button>
              )}
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
                onClick={() => deleteTask(task)}
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
              <label className="plan-session-note-label">
                Add a note (optional)
                <textarea
                  value={sessionNote}
                  onChange={(event) => setSessionNote(event.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="What did you cover?"
                  className="plan-session-note"
                />
              </label>
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
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="plan-sort" role="group" aria-label="Sort plans">
            <button type="button" className={sortBy === "plan" ? "is-on" : ""} aria-pressed={sortBy === "plan"} onClick={() => chooseSort("plan")}>
              Plan
            </button>
            <button type="button" className={sortBy === "date" ? "is-on" : ""} aria-pressed={sortBy === "date"} onClick={() => chooseSort("date")}>
              Date
            </button>
          </div>
          <p className="plan-studied" aria-live="polite">
            Studied today <strong>{formatHoursMinutes(studiedMinutes + liveStudied)}</strong>
          </p>
        </div>
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

      {sortBy === "plan" && plans.length > 0 && (
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
          {sortBy === "plan" && (
            <>
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
              onClick={() => deletePlan(plan.id)}
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
            </>
          )}

          {sortBy === "date" ? (
            <div className="space-y-5">
              {displayedDays.map((group) => {
                const stats = dayStats(group.tasks);
                const leftover = leftoverOnDay(group.tasks, today);
                const ended = group.date < today;
                const expanded = !ended
                  || Boolean(openEnded[group.date])
                  || addingDate === group.date
                  || Boolean(session && group.tasks.some((task) => task.id === session.taskId));
                const draggingThisDay = Boolean(expanded && dragId && dragDateRef.current === group.date);
                const dayTasks = draggingThisDay && dragId
                  ? group.tasks.filter((task) => task.id !== dragId)
                  : group.tasks;
                return (
                  <div key={group.date} className={`plan-day ${ended ? "is-ended" : ""} ${expanded ? "" : "is-collapsed"}`}>
                    <div className={`plan-day-head ${group.date === selectedDate ? "is-selected" : ""}`}>
                      <div className="plan-day-top">
                        {ended ? (
                          <button
                            type="button"
                            className="plan-day-toggle"
                            aria-expanded={expanded}
                            aria-label={`${expanded ? "Collapse" : "Expand"} ${dueLabel(group.date)}`}
                            onClick={() => toggleEnded(group.date)}
                          >
                            <Icon
                              icon={ArrowRight01Icon}
                              size={14}
                              className={`plan-day-chevron ${expanded ? "is-open" : ""}`}
                            />
                            <span className="plan-day-date">{dueLabel(group.date)}</span>
                          </button>
                        ) : (
                          <p className="plan-day-date">{dueLabel(group.date)}</p>
                        )}
                        {leftover.length > 0 && (
                          <button
                            type="button"
                            className="plan-day-add plan-day-today"
                            disabled={saving}
                            onClick={() => moveTasksToToday(group.tasks)}
                            aria-label={`Move ${leftover.length} leftover ${leftover.length === 1 ? "task" : "tasks"} to today`}
                          >
                            <Icon icon={Calendar03Icon} size={14} /> Today
                          </button>
                        )}
                        <button
                          type="button"
                          className="plan-day-add"
                          aria-expanded={addingDate === group.date}
                          aria-label={`Add a task on ${dueLabel(group.date)}`}
                          onClick={() => {
                            if (ended) setOpenEnded((current) => ({ ...current, [group.date]: true }));
                            setAddingDate(addingDate === group.date ? null : group.date);
                            setDayTask("");
                            setDayMinutes(20);
                          }}
                        >
                          <Icon icon={Add01Icon} size={14} /> Add
                        </button>
                      </div>
                      <DayMeta
                        date={group.date}
                        total={stats.total}
                        doneCount={stats.doneCount}
                        planned={stats.planned}
                      />
                    </div>
                    {expanded && addingDate === group.date && (
                      <form onSubmit={(event) => addTaskOnDate(event, group.date)} className="plan-day-form">
                        <input
                          autoFocus
                          value={dayTask}
                          onChange={(event) => setDayTask(event.target.value)}
                          placeholder={`Add to ${plan.title}`}
                          className="field min-w-[12rem] flex-1 py-2"
                        />
                        <input
                          type="number"
                          min={5}
                          max={240}
                          value={dayMinutes}
                          onChange={(event) => setDayMinutes(Number(event.target.value))}
                          className="field w-24 py-2"
                          aria-label="Minutes"
                        />
                        <button disabled={saving || !dayTask.trim()} className="btn-secondary py-2 text-sm">
                          <Icon icon={Add01Icon} size={14} /> Add
                        </button>
                      </form>
                    )}
                    {expanded && (
                    <div
                      className={`plan-task-list ${draggingThisDay ? "is-sorting" : ""}`}
                      ref={(node) => {
                        dateListRefs.current[group.date] = node;
                      }}
                    >
                      {dayTasks.map((task, index) =>
                        renderTask(task, index, {
                          canDrag: true,
                          dropActive: draggingThisDay,
                          date: group.date,
                          meta: `${task.planTitle} · ${task.minutes} min`,
                        }),
                      )}
                      {draggingThisDay && insertIndex === dayTasks.length && (
                        <div className="plan-drop" aria-hidden>
                          <span />
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
          <div className={`plan-task-list ${dragId ? "is-sorting" : ""}`} ref={listRef}>
            {visibleTasks.map((task, index) =>
              renderTask(task, index, {
                canDrag: true,
                dropActive: Boolean(dragId),
                meta: `${dueLabel(task.due_date)} · ${task.minutes} min`,
              }),
            )}
            {dragId && insertIndex === visibleTasks.length && (
              <div className="plan-drop" aria-hidden>
                <span />
              </div>
            )}
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
                  <p className="plan-task-meta">
                    {"planTitle" in floatTask
                      ? `${floatTask.planTitle} · ${floatTask.minutes} min`
                      : `${dueLabel(floatTask.due_date)} · ${floatTask.minutes} min`}
                  </p>
                  {floatTask.note ? <p className="plan-task-note">{floatTask.note}</p> : null}
                </div>
              </div>
            </div>
          )}

          {sortBy === "plan" && (
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
          )}
        </div>
      )}
    </section>
  );
}
