"use client";

import { useMemo, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const MUTED = "rgba(10, 10, 10, 0.18)";
const FILLED = "#0A0A0A";

type ScrollFillHeadingProps = {
  children: string;
  className?: string;
  id?: string;
};

export function ScrollFillHeading({ children, className = "", id }: ScrollFillHeadingProps) {
  const wrap = useRef<HTMLHeadingElement>(null);
  const words = useMemo(() => children.split(/\s+/).filter(Boolean), [children]);

  useGSAP(
    () => {
      const root = wrap.current;
      if (!root) return;

      const spans = root.querySelectorAll<HTMLElement>(".scroll-fill-word");
      if (!spans.length) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        gsap.set(spans, { color: FILLED });
        return;
      }

      gsap.set(spans, { color: MUTED });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: "top 90%",
          end: "top 30%",
          scrub: 0.55,
        },
      });

      spans.forEach((word, index) => {
        tl.to(
          word,
          { color: FILLED, duration: 1, ease: "none" },
          index * 0.65,
        );
      });
    },
    { scope: wrap, dependencies: [children] },
  );

  return (
    <h2 id={id} ref={wrap} className={className}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="scroll-fill-word">
          {word}
          {index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </h2>
  );
}
