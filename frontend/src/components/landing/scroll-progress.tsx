"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { getLenis } from "@/lib/lenis-scroll";

export function ScrollProgress() {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduced) return;

    const lenis = getLenis();
    const updateFromWindow = () => {
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(limit > 0 ? window.scrollY / limit : 0);
    };

    if (!lenis) {
      updateFromWindow();
      window.addEventListener("scroll", updateFromWindow, { passive: true });
      return () => window.removeEventListener("scroll", updateFromWindow);
    }

    const onScroll = () => setProgress(lenis.progress);
    lenis.on("scroll", onScroll);
    onScroll();

    return () => {
      lenis.off("scroll", onScroll);
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <div className="scroll-progress" aria-hidden>
      <div className="scroll-progress-bar" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}
