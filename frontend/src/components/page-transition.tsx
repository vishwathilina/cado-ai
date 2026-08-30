"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export const pageEase = [0.22, 1, 0.36, 1] as const;
export const relaxedEase = [0.16, 1, 0.3, 1] as const;

const pageFadeIn = {
  duration: 0.62,
  ease: relaxedEase,
} as const;

const pageFadeOut = {
  duration: 0.48,
  ease: [0.4, 0, 0.2, 1] as const,
};

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        className={pathname.startsWith("/quiz") ? "h-dvh overflow-hidden" : "min-h-full"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: reduce ? { duration: 0.18 } : pageFadeIn }}
        exit={{ opacity: 0, transition: reduce ? { duration: 0.12 } : pageFadeOut }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function FadeLoading({
  className,
}: {
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      className={`fade-loading ${className ?? ""}`}
      initial={{ opacity: 0.4 }}
      animate={reduce ? { opacity: 0.55 } : { opacity: [0.38, 0.62, 0.38] }}
      transition={
        reduce
          ? { duration: 0.2 }
          : { duration: 2.8, ease: "easeInOut", repeat: Infinity }
      }
    />
  );
}

export function LoadingScreen({
  children,
  className = "grid min-h-[min(70vh,32rem)] place-items-center p-6",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <FadeLoadingGroup className="w-full max-w-2xl space-y-4">
        {children ?? (
          <>
            <FadeLoading className="h-6 w-36 rounded-full" />
            <FadeLoading className="h-40 rounded-3xl" />
            <FadeLoading className="h-24 rounded-2xl" />
          </>
        )}
      </FadeLoadingGroup>
    </div>
  );
}

export function LoadingOverlay({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={`loading-overlay ${className ?? ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.12 : 0.4, ease: relaxedEase }}
      aria-live="polite"
      aria-busy="true"
    >
      <FadeLoadingGroup className="loading-overlay-panel space-y-3">
        <FadeLoading className="h-3 w-24 rounded-full" />
        <FadeLoading className="h-10 rounded-xl" />
        <FadeLoading className="h-10 rounded-xl" />
        {label ? <p className="loading-overlay-label">{label}</p> : null}
      </FadeLoadingGroup>
    </motion.div>
  );
}

export function LoadingInline({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div className={className} aria-live="polite" aria-busy="true">
      <FadeLoading className="h-full min-h-[5rem] w-full rounded-xl" />
      {label ? <p className="loading-inline-label">{label}</p> : null}
    </div>
  );
}

export function FadeLoadingGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0.15 : 0.7, ease: relaxedEase }}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.2 : 0.5, delay: reduce ? 0 : delay, ease: relaxedEase }}
    >
      {children}
    </motion.div>
  );
}

export function ScrollIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: "-40px 0px -80px 0px" }}
      transition={{ duration: reduce ? 0.16 : 0.55, delay: reduce ? 0 : delay, ease: pageEase }}
    >
      {children}
    </motion.div>
  );
}
