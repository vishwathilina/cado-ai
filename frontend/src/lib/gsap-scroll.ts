import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollToPlugin);

export type GsapSmoothScrollOptions = {
  wheelDuration?: number;
  wheelEase?: gsap.EaseString;
  wheelScale?: number;
};

const scrollProxy = { y: 0 };
let targetY = 0;
let wheelQuick: gsap.QuickToFunc | null = null;
let anchorTween: gsap.core.Tween | null = null;
let activeWheelOptions: GsapSmoothScrollOptions = {};

function maxScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function normalizeWheelDelta(event: WheelEvent) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

function syncProxy(y = window.scrollY) {
  scrollProxy.y = y;
  targetY = y;
}

function resetWheelQuick() {
  wheelQuick = null;
}

function ensureWheelQuick() {
  if (wheelQuick) return wheelQuick;

  wheelQuick = gsap.quickTo(scrollProxy, "y", {
    duration: activeWheelOptions.wheelDuration ?? 0.55,
    ease: activeWheelOptions.wheelEase ?? "power1.out",
    overwrite: true,
    onUpdate: () => {
      window.scrollTo(0, scrollProxy.y);
      targetY = scrollProxy.y;
    },
  });

  return wheelQuick;
}

export function syncScrollTarget(y = window.scrollY) {
  syncProxy(y);
  anchorTween?.kill();
  anchorTween = null;
  resetWheelQuick();
}

export function scrollToY(y: number, duration = 0.9, ease: gsap.EaseString = "power3.inOut") {
  targetY = gsap.utils.clamp(0, maxScroll(), y);
  anchorTween?.kill();
  resetWheelQuick();
  syncProxy(window.scrollY);

  anchorTween = gsap.to(window, {
    scrollTo: { y: targetY, autoKill: false },
    duration,
    ease,
    onUpdate: () => syncProxy(window.scrollY),
    onComplete: () => {
      syncProxy(window.scrollY);
      anchorTween = null;
    },
  });

  return targetY;
}

export function scrollByWheel(deltaY: number) {
  if (anchorTween?.isActive()) {
    anchorTween.kill();
    anchorTween = null;
    syncProxy(window.scrollY);
  }

  const scale = activeWheelOptions.wheelScale ?? 1;
  targetY = gsap.utils.clamp(0, maxScroll(), targetY + deltaY * scale);
  ensureWheelQuick()(targetY);
}

export function bindGsapSmoothScroll(options: GsapSmoothScrollOptions = {}) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return () => {};

  activeWheelOptions = options;
  syncProxy(window.scrollY);
  let scrollEndTimer = 0;

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) return;

    const scrollable = findScrollableAncestor(event.target, event.deltaY);
    if (scrollable) return;

    event.preventDefault();
    scrollByWheel(normalizeWheelDelta(event));
  };

  const onScroll = () => {
    if (anchorTween?.isActive() || wheelQuick) return;
    window.clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(() => {
      if (!anchorTween?.isActive()) {
        syncProxy(window.scrollY);
      }
    }, 80);
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    anchorTween?.kill();
    anchorTween = null;
    resetWheelQuick();
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

export function hashFromHref(href: string) {
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1) return "";
  return href.slice(hashIndex + 1);
}

export function isSamePageHashLink(href: string, pathname: string) {
  if (!href.includes("#")) return false;
  if (href.startsWith("#")) return true;
  if (href.startsWith("/#")) return pathname === "/";
  try {
    const url = new URL(href, window.location.origin);
    return url.pathname === pathname && Boolean(url.hash);
  } catch {
    return false;
  }
}
