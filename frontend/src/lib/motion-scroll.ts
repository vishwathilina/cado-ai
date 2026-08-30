import { animate, type AnimationPlaybackControls } from "framer-motion";

let controls: AnimationPlaybackControls | null = null;
let targetY = 0;

const smoothEase = [0.16, 1, 0.3, 1] as const;

function maxScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function clamp(y: number) {
  return Math.max(0, Math.min(maxScroll(), y));
}

function normalizeWheelDelta(event: WheelEvent) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

export function syncMotionScrollTarget(y = window.scrollY) {
  targetY = y;
  controls?.stop();
  controls = null;
}

export function scrollToY(y: number, duration = 0.9) {
  targetY = clamp(y);
  controls?.stop();
  controls = animate(window.scrollY, targetY, {
    duration,
    ease: smoothEase,
    onUpdate: (value) => window.scrollTo(0, value),
    onComplete: () => {
      targetY = window.scrollY;
      controls = null;
    },
  });
  return targetY;
}

export function scrollByWheel(deltaY: number, duration = 0.5) {
  if (!controls) {
    targetY = window.scrollY;
  }

  targetY = clamp(targetY + deltaY);
  controls?.stop();
  controls = animate(window.scrollY, targetY, {
    duration,
    ease: smoothEase,
    onUpdate: (value) => window.scrollTo(0, value),
    onComplete: () => {
      targetY = window.scrollY;
      controls = null;
    },
  });
}

export function bindMotionSmoothScroll() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return () => {};

  targetY = window.scrollY;
  let scrollEndTimer = 0;

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) return;

    const scrollable = findScrollableAncestor(event.target, event.deltaY);
    if (scrollable) return;

    event.preventDefault();
    scrollByWheel(normalizeWheelDelta(event));
  };

  const onScroll = () => {
    if (controls) return;
    window.clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(() => {
      if (!controls) {
        targetY = window.scrollY;
      }
    }, 80);
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    controls?.stop();
    controls = null;
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("scroll", onScroll);
    window.clearTimeout(scrollEndTimer);
  };
}

function canScrollElement(element: HTMLElement, deltaY: number) {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") return false;
  if (element.scrollHeight <= element.clientHeight) return false;

  const scrollingDown = deltaY > 0;
  const atTop = element.scrollTop <= 0;
  const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;

  return (scrollingDown && !atBottom) || (!scrollingDown && !atTop);
}

function findScrollableAncestor(target: EventTarget | null, deltaY: number) {
  let element = target instanceof HTMLElement ? target : null;

  while (element && element !== document.documentElement) {
    if (canScrollElement(element, deltaY)) return element;
    element = element.parentElement;
  }

  return null;
}
