"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type HoldToConfirmProps = {
  label?: string;
  holdingLabel?: string;
  readyLabel?: string;
  hint?: string;
  confirmTimeout?: number;
  className?: string;
  onConfirm: () => void;
  disabled?: boolean;
};

export function HoldToConfirm({
  label = "Hold to confirm",
  holdingLabel = "Keep holding…",
  readyLabel = "Release to confirm",
  hint = "Press and hold to confirm",
  confirmTimeout = 1.15,
  className,
  onConfirm,
  disabled,
}: HoldToConfirmProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<"idle" | "holding" | "ready">("idle");
  const progress = useMotionValue(0);
  const fillWidth = useTransform(progress, (value) => `${value * 100}%`);
  const duration = reduce ? 0.12 : confirmTimeout;

  function cancel() {
    progress.stop();
    setState("idle");
    animate(progress, 0, { duration: 0.18, ease: "linear" });
  }

  function start() {
    if (disabled) return;
    setState("holding");
    animate(progress, 1, { duration, ease: "linear" }).then(() => {
      if (progress.get() >= 0.99) setState("ready");
    });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (progress.get() >= 0.99 && target && ref.current?.contains(target)) {
      onConfirm();
      progress.set(0);
      setState("idle");
      return;
    }
    cancel();
  }

  const text = state === "idle" ? label : state === "holding" ? holdingLabel : readyLabel;

  return (
    <div className={`hold-confirm ${className ?? ""}`}>
      <motion.button
        ref={ref}
        type="button"
        disabled={disabled}
        className="hold-confirm-btn"
        onPointerDown={start}
        onPointerUp={onPointerUp}
        onPointerCancel={cancel}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") cancel();
        }}
        onContextMenuCapture={(event) => event.preventDefault()}
        aria-live="polite"
      >
        <motion.span aria-hidden className="hold-confirm-fill" style={{ width: fillWidth }} />
        <span className="hold-confirm-text">{text}</span>
      </motion.button>
      {hint ? <p className="hold-confirm-hint">{hint}</p> : null}
    </div>
  );
}
