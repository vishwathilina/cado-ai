import Lenis from "lenis";

let lenis: Lenis | null = null;

export type LenisScrollOptions = {
  lerp?: number;
  duration?: number;
  wheelMultiplier?: number;
  touchMultiplier?: number;
};

export const MARKETING_LENIS_OPTIONS: LenisScrollOptions = {
  lerp: 0.08,
  duration: 1.2,
  wheelMultiplier: 0.85,
  touchMultiplier: 1.5,
};

export function getLenis() {
  return lenis;
}

export function bindLenisScroll(options: LenisScrollOptions = MARKETING_LENIS_OPTIONS) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return () => {};

  document.documentElement.classList.add("lenis", "lenis-smooth");

  lenis = new Lenis({
    lerp: options.lerp ?? MARKETING_LENIS_OPTIONS.lerp,
    duration: options.duration ?? MARKETING_LENIS_OPTIONS.duration,
    wheelMultiplier: options.wheelMultiplier ?? MARKETING_LENIS_OPTIONS.wheelMultiplier,
    touchMultiplier: options.touchMultiplier ?? MARKETING_LENIS_OPTIONS.touchMultiplier,
    smoothWheel: true,
    autoRaf: true,
  });

  return () => {
    lenis?.destroy();
    lenis = null;
    document.documentElement.classList.remove("lenis", "lenis-smooth", "lenis-scrolling");
  };
}

export function scrollToY(y: number, duration = 1.4) {
  if (lenis) {
    lenis.scrollTo(y, { duration });
    return;
  }

  window.scrollTo({ top: y, behavior: "smooth" });
}

export function scrollToSection(id: string, offset = -80) {
  const target = document.getElementById(id);
  if (!target) return;

  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.5 });
  } else {
    scrollToY(target.getBoundingClientRect().top + window.scrollY + offset);
  }

  history.replaceState(null, "", `#${id}`);
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

export function scrollToHref(href: string, offset = -80) {
  const id = hashFromHref(href);
  if (!id) return;
  scrollToSection(id, offset);
}
