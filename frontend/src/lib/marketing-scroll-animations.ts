import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Prevent GSAP from hiding elements before ScrollTrigger fires. */
export function reveal(vars: gsap.TweenVars) {
  return { ...vars, immediateRender: false };
}

/** Sync ScrollTrigger with Lenis after layout/images settle; unstick past reveals. */
export function refreshMarketingScrollTriggers() {
  ScrollTrigger.refresh();

  requestAnimationFrame(() => {
    ScrollTrigger.getAll().forEach((trigger) => {
      const animation = trigger.animation;
      if (!animation || animation.progress() > 0) return;
      if (trigger.progress > 0 || trigger.isActive) {
        animation.progress(1);
      }
    });
  });
}
