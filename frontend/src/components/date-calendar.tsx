"use client";

import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon } from "@hugeicons/core-free-icons";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { isoDate, parseIsoDate, prettyDate } from "@/lib/dates";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function shiftMonth(value: Date, delta: number) {
  return new Date(value.getFullYear(), value.getMonth() + delta, 1);
}

function monthCells(view: Date) {
  const first = startOfMonth(view);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(new Date(view.getFullYear(), view.getMonth(), day));
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function DateCalendar({
  value,
  onChange,
  min,
  max,
  compact = false,
}: {
  value: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
  compact?: boolean;
}) {
  const blobId = useId();
  const reduceMotion = useReducedMotion();
  const selected = value ? parseIsoDate(value) : null;
  const [view, setView] = useState(() => startOfMonth(selected ?? new Date()));
  const [direction, setDirection] = useState(1);
  const today = isoDate();

  useEffect(() => {
    if (!value) return;
    const next = startOfMonth(parseIsoDate(value));
    setView((current) =>
      current.getFullYear() === next.getFullYear() && current.getMonth() === next.getMonth()
        ? current
        : next,
    );
  }, [value]);

  const cells = useMemo(() => monthCells(view), [view]);
  const label = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const minMonth = min ? startOfMonth(parseIsoDate(min)) : null;
  const maxMonth = max ? startOfMonth(parseIsoDate(max)) : null;
  const canPrev = !minMonth || view > minMonth;
  const canNext = !maxMonth || view < maxMonth;

  function go(delta: number) {
    setDirection(delta);
    setView((current) => shiftMonth(current, delta));
  }

  const slide = reduceMotion
    ? { duration: 0.12 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className={`cal ${compact ? "is-compact" : ""}`}>
      <div className="cal-nav">
        <motion.button type="button" className="cal-nav-btn" onClick={() => go(-1)} disabled={!canPrev} aria-label="Previous month" whileTap={reduceMotion ? undefined : { scale: 0.86 }}>
          <Icon icon={ArrowLeft01Icon} size={14} />
        </motion.button>
        <div className="relative min-h-5 flex-1 overflow-hidden text-center">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.p
              key={label}
              custom={direction}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: direction * 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: direction * -8 }}
              transition={slide}
              className="text-sm font-semibold"
            >
              {label}
            </motion.p>
          </AnimatePresence>
        </div>
        <motion.button type="button" className="cal-nav-btn" onClick={() => go(1)} disabled={!canNext} aria-label="Next month" whileTap={reduceMotion ? undefined : { scale: 0.86 }}>
          <Icon icon={ArrowRight01Icon} size={14} />
        </motion.button>
      </div>

      <div className="cal-week">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={label}
            custom={direction}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -28 }}
            transition={slide}
            className="cal-grid"
          >
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const key = isoDate(day);
              const isSelected = key === value;
              const isToday = key === today;
              const tooSoon = Boolean(min && key < min);
              const tooLate = Boolean(max && key > max);
              return (
                <motion.button
                  key={key}
                  type="button"
                  disabled={tooSoon || tooLate}
                  onClick={() => onChange(key)}
                  whileHover={reduceMotion || tooSoon || tooLate ? undefined : { scale: 1.08 }}
                  whileTap={reduceMotion || tooSoon || tooLate ? undefined : { scale: 0.9 }}
                  className={`cal-day ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
                  aria-label={day.toLocaleDateString(undefined, { dateStyle: "long" })}
                  aria-pressed={isSelected}
                >
                  {isSelected && (
                    <motion.span
                      layoutId={`cal-blob-${blobId}`}
                      className="cal-blob"
                      transition={
                        reduceMotion
                          ? { duration: 0.12 }
                          : { type: "spring", stiffness: 420, damping: 28 }
                      }
                    />
                  )}
                  <span className="relative z-[1]">{day.getDate()}</span>
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function DatePicker({
  value,
  defaultValue = "",
  onChange,
  name,
  min,
  max,
  variant = "popover",
  allowEmpty = false,
  placeholder = "Pick a date",
  className = "",
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  name?: string;
  min?: string;
  max?: string;
  variant?: "popover" | "inline";
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(variant === "inline");
  const [inner, setInner] = useState(value ?? defaultValue);
  const selected = value ?? inner;
  const reduceMotion = useReducedMotion();

  function pick(next: string) {
    setInner(next);
    onChange?.(next);
    if (variant === "popover") setOpen(false);
  }

  useEffect(() => {
    if (variant !== "popover" || !open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, variant]);

  const calendar = (
    <DateCalendar
      value={selected}
      onChange={pick}
      min={min}
      max={max}
      compact={variant === "inline"}
    />
  );

  return (
    <div ref={root} className={`cal-picker ${className}`.trim()}>
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      {variant === "inline" ? (
        <div className="cal-panel">
          {calendar}
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={selected || "empty"}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="muted mt-2 text-center text-xs font-medium"
            >
              {selected ? prettyDate(selected, "long") : placeholder}
            </motion.p>
          </AnimatePresence>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="cal-trigger"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <Icon icon={Calendar03Icon} size={16} />
            <span className={selected ? "" : "muted"}>{selected ? prettyDate(selected) : placeholder}</span>
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                role="dialog"
                aria-label="Choose a date"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="cal-pop"
              >
                {calendar}
                {allowEmpty && selected ? (
                  <button type="button" className="muted mt-2 w-full text-xs" onClick={() => pick("")}>
                    Clear date
                  </button>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
