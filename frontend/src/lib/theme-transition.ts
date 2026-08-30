export type ThemeMode = "light" | "dark";
export type ThemeTransitionOrigin = { x: number; y: number };

export type ThemeTransitionOptions = {
  origin?: ThemeTransitionOrigin;
  to?: ThemeMode;
};

export function applyTheme(resolved: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setCircleTransitionVars(origin: ThemeTransitionOrigin, to?: ThemeMode) {
  const { x, y } = origin;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  const root = document.documentElement;
  root.style.setProperty("--theme-transition-x", `${x}px`);
  root.style.setProperty("--theme-transition-y", `${y}px`);
  root.style.setProperty("--theme-transition-r", `${radius}px`);
  root.classList.toggle("theme-transition-to-dark", to === "dark");
  root.classList.toggle("theme-transition-to-light", to === "light");
}

function mountBurstOverlay(origin: ThemeTransitionOrigin) {
  const overlay = document.createElement("div");
  overlay.className = "theme-burst-overlay";
  overlay.innerHTML = `
    <div class="theme-burst-core" aria-hidden="true"></div>
    <div class="theme-burst-ring" aria-hidden="true"></div>
    <div class="theme-burst-shockwave" aria-hidden="true"></div>
  `;
  overlay.style.setProperty("--theme-transition-x", `${origin.x}px`);
  overlay.style.setProperty("--theme-transition-y", `${origin.y}px`);
  overlay.style.setProperty(
    "--theme-transition-r",
    `${Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y))}px`,
  );
  document.body.appendChild(overlay);
  return overlay;
}

function clearTransitionVars() {
  const root = document.documentElement;
  root.classList.remove(
    "theme-transition-circle",
    "theme-transition-fade",
    "theme-transition-active",
    "theme-transition-to-dark",
    "theme-transition-to-light",
  );
  root.style.removeProperty("--theme-transition-x");
  root.style.removeProperty("--theme-transition-y");
  root.style.removeProperty("--theme-transition-r");
  document.querySelectorAll(".theme-burst-overlay").forEach((node) => node.remove());
}

export function runThemeTransition(commit: () => void, options?: ThemeTransitionOptions) {
  if (prefersReducedMotion() || !("startViewTransition" in document)) {
    commit();
    return;
  }

  const root = document.documentElement;
  const { origin, to } = options ?? {};
  root.classList.add("theme-transition-active");
  root.classList.add(origin ? "theme-transition-circle" : "theme-transition-fade");

  let overlay: HTMLDivElement | null = null;
  if (origin) {
    setCircleTransitionVars(origin, to);
    overlay = mountBurstOverlay(origin);
  }

  const transition = document.startViewTransition(commit);
  void transition.finished.finally(() => {
    overlay?.classList.add("is-done");
    window.setTimeout(clearTransitionVars, 120);
  });
}

export function themeToggleOrigin(
  event: Pick<MouseEvent, "clientX" | "clientY"> | Pick<TouchEvent, "touches">,
): ThemeTransitionOrigin {
  if ("touches" in event && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  if ("clientX" in event) {
    return { x: event.clientX, y: event.clientY };
  }

  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}
