"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ArrowUp, Check, Globe, Paperclip, PlayCircle } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { FaqSection } from "@/components/faq-section";
import { FeatureGrid } from "@/components/feature-grid";
import { Footer } from "@/components/footer";
import { MarketingHeader } from "@/components/marketing-header";
import { PricingSection } from "@/components/pricing-section";
import { SideNav } from "@/components/side-nav";
import { refreshMarketingScrollTriggers, reveal } from "@/lib/marketing-scroll-animations";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const agentChips = [
  "Cell structure overview",
  "Mitosis flashcards",
  "Chapter 4 quiz",
  "Week plan generated",
];

/** Play once — no re-trigger when scrolling back up. */
const once = { toggleActions: "play none none none" as const };

export function MarketingLanding() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });

      heroTl
        .from(".hero-line", { yPercent: 110, opacity: 0, duration: 1.05, stagger: 0.11 })
        .from(".hero-copy", { y: 28, opacity: 0, duration: 0.8 }, "-=0.55")
        .from(".hero-cta", { y: 20, opacity: 0, duration: 0.7 }, "-=0.45")
        .from(
          ".hero-visual",
          { y: 20, opacity: 0, duration: 0.95, ease: "power3.out" },
          "-=0.75",
        );

      gsap.to(".hero-visual", {
        y: -6,
        duration: 3.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 1,
      });

      gsap.from(".use-cases-copy > *", reveal({
        scrollTrigger: {
          trigger: "#use-cases",
          start: "top 88%",
          ...once,
        },
        y: 40,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
      }));

      gsap.from(".use-cases-prompt", reveal({
        scrollTrigger: {
          trigger: ".use-cases-visual",
          start: "top 82%",
          ...once,
        },
        y: 56,
        opacity: 0,
        scale: 0.96,
        duration: 1,
        ease: "power3.out",
      }));

      gsap.to(".use-cases-visual .use-cases-image", {
        scrollTrigger: {
          trigger: ".use-cases-visual",
          start: "top bottom",
          end: "bottom top",
          scrub: 1.1,
        },
        yPercent: 8,
        ease: "none",
      });

      gsap.from("#command-center .section-heading > *", reveal({
        scrollTrigger: {
          trigger: "#command-center",
          start: "top 86%",
          ...once,
        },
        y: 32,
        opacity: 0,
        duration: 0.85,
        stagger: 0.14,
        ease: "power3.out",
      }));

      gsap.from(".feature-card", reveal({
        scrollTrigger: {
          trigger: "#command-center",
          start: "top 78%",
          ...once,
        },
        y: 48,
        opacity: 0,
        scale: 0.97,
        duration: 0.75,
        stagger: {
          each: 0.08,
          from: "start",
        },
        ease: "power2.out",
      }));

      gsap.from(".agents-copy > *", reveal({
        scrollTrigger: {
          trigger: "#agents",
          start: "top 88%",
          ...once,
        },
        x: -28,
        opacity: 0,
        duration: 0.85,
        stagger: 0.1,
        ease: "power3.out",
      }));

      gsap.from(".agents-panel", reveal({
        scrollTrigger: {
          trigger: ".agents-visual",
          start: "top 82%",
          ...once,
        },
        y: 64,
        opacity: 0,
        scale: 0.95,
        duration: 1.05,
        ease: "power3.out",
      }));

      gsap.from(".agents-chip", reveal({
        scrollTrigger: {
          trigger: ".agents-panel",
          start: "top 78%",
          ...once,
        },
        y: 16,
        opacity: 0,
        scale: 0.92,
        duration: 0.55,
        stagger: 0.07,
        ease: "power2.out",
        delay: 0.12,
      }));

      gsap.to(".agents-visual .agents-image", {
        scrollTrigger: {
          trigger: ".agents-visual",
          start: "top bottom",
          end: "bottom top",
          scrub: 1.1,
        },
        yPercent: 6,
        ease: "none",
      });

      gsap.from(".landing-quote", reveal({
        scrollTrigger: {
          trigger: ".landing-quote",
          start: "top 88%",
          ...once,
        },
        y: 24,
        opacity: 0,
        scale: 0.98,
        duration: 1,
        ease: "power3.out",
      }));

      gsap.from("#pricing .section-heading > p", reveal({
        scrollTrigger: {
          trigger: "#pricing",
          start: "top 86%",
          ...once,
        },
        y: 36,
        opacity: 0,
        duration: 0.85,
        stagger: 0.1,
        ease: "power3.out",
      }));

      gsap.from(".pricing-card", reveal({
        scrollTrigger: {
          trigger: "#pricing .pricing-grid",
          start: "top 82%",
          ...once,
        },
        y: 44,
        opacity: 0,
        scale: 0.98,
        duration: 0.8,
        stagger: 0.1,
        ease: "power2.out",
      }));

      gsap.from("#faq .section-heading > *", reveal({
        scrollTrigger: {
          trigger: "#faq",
          start: "top 88%",
          ...once,
        },
        y: 28,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
      }));

      gsap.from(".faq-item", reveal({
        scrollTrigger: {
          trigger: "#faq .faq-list",
          start: "top 84%",
          ...once,
        },
        y: 24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: "power2.out",
      }));

      gsap.from(".landing-footer", reveal({
        scrollTrigger: {
          trigger: ".landing-footer",
          start: "top 92%",
          ...once,
        },
        y: 20,
        opacity: 0,
        duration: 0.75,
        ease: "power2.out",
      }));

      const refresh = () => refreshMarketingScrollTriggers();
      requestAnimationFrame(refresh);
      window.addEventListener("load", refresh);
      return () => window.removeEventListener("load", refresh);
    },
    { scope: root },
  );

  return (
    <main id="top" ref={root} className="min-h-screen overflow-x-clip bg-white text-[#0A0A0A]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-black focus:text-white focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <MarketingHeader />

      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-6 md:grid-cols-[200px_1fr]">
        <aside className="hidden md:block">
          <SideNav />
        </aside>

        <div id="main-content" className="min-w-0">
          <section
            id="product"
            className="grid scroll-mt-20 grid-cols-1 items-center gap-12 pb-32 pt-20 lg:grid-cols-[1fr_auto]"
          >
            <div>
              <h1 className="font-serif text-7xl font-medium leading-[1.02] tracking-tight text-balance md:text-8xl">
                <span className="hero-line block overflow-hidden">
                  <span className="block">Notes that</span>
                </span>
                <span className="hero-line block overflow-hidden">
                  <span className="block">study themselves</span>
                </span>
              </h1>
              <p className="hero-copy mt-8 max-w-md text-sm leading-relaxed text-black/60">
                Upload your PDFs, slides, or photos. Cado builds explanations, flashcards, scored quizzes,
                and a seven-day plan — so you always know what to study next.
              </p>
              <Link
                href="/register"
                className="hero-cta mt-6 inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
              >
                <PlayCircle className="size-4" />
                See how Cado works
              </Link>
            </div>
            <div className="hero-visual relative hidden size-[360px] overflow-hidden rounded-2xl bg-black lg:block">
              <Image
                src="/pixel-automation.png"
                alt="Pixel art CRT showing study sessions, surrounded by gears, sparkles, mail, calendar, a checkmark, and a sunflower"
                fill
                className="object-contain"
                sizes="360px"
                priority
              />
            </div>
          </section>

          <section id="use-cases" className="mt-16 scroll-mt-20">
            <div className="use-cases-copy mb-8 flex items-end justify-between gap-6">
              <h2 className="max-w-md font-serif text-3xl font-medium tracking-tight text-balance md:text-4xl">
                Upload once. Study all week.
              </h2>
              <p className="hidden max-w-xs text-sm leading-relaxed text-black/60 md:block">
                One file is enough. Cado figures out the sections, the cards, and the quiz.
              </p>
            </div>
            <div className="use-cases-visual relative aspect-[21/9] overflow-hidden rounded-3xl">
              <Image
                src="/pixel-landscape.jpg"
                alt="Pixel art landscape with sunflowers, mountains, and a lake"
                fill
                className="use-cases-image object-cover"
                sizes="(min-width: 768px) 78vw, 100vw"
              />
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <div className="use-cases-prompt flex w-[min(560px,100%)] items-center justify-between gap-4 rounded-2xl border border-white/40 bg-white/60 p-5 shadow-xl backdrop-blur-xl">
                  <Paperclip className="size-5 shrink-0 text-black/50" />
                  <span className="flex-1 truncate text-[15px] text-black/70">
                    Turn my biology notes into flashcards and a quiz
                  </span>
                  <button
                    type="button"
                    aria-label="Send"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-black/90"
                  >
                    <ArrowUp className="size-5" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section id="command-center" className="scroll-mt-20 py-20">
            <header className="section-heading">
              <h2 className="text-center font-serif text-3xl font-medium tracking-tight text-balance md:text-4xl">
                A semester&apos;s worth of things Cado can do
              </h2>
              <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-black/60">
                Each one starts with your notes. None of them need babysitting.
              </p>
            </header>
            <FeatureGrid />
          </section>

          <section id="agents" className="mt-16 scroll-mt-20">
            <div className="agents-copy mb-8 flex items-end justify-between gap-6">
              <h2 className="max-w-md font-serif text-3xl font-medium tracking-tight text-balance md:text-4xl">
                From upload to quiz in one flow
              </h2>
              <p className="hidden max-w-xs text-sm leading-relaxed text-black/60 md:block">
                Upload notes. Cado builds learn mode, flashcards, and a scored quiz. The loop closes itself.
              </p>
            </div>
            <div className="agents-visual relative aspect-[21/9] overflow-hidden rounded-3xl">
              <Image
                src="/pixel-meadow.jpg"
                alt="Pixel art meadow with poppies and wildflowers"
                fill
                className="agents-image object-cover"
                sizes="(min-width: 768px) 78vw, 100vw"
              />
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <div className="agents-panel w-[min(520px,100%)] rounded-2xl border border-white/50 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
                  <div className="text-sm font-semibold">Biology Notes to Study Session</div>
                  <div className="mt-3 flex flex-wrap gap-2 opacity-50">
                    {agentChips.map((chip) => (
                      <span
                        key={chip}
                        className="agents-chip flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs"
                      >
                        <Globe className="size-3 text-black/50" />
                        {chip}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <span className="flex size-4 items-center justify-center rounded-full bg-black text-white">
                      <Check className="size-3" />
                    </span>
                    <span>
                      Building quiz questions <span className="text-black/50">· Completed</span>
                    </span>
                  </div>
                  <div className="mt-2 ml-6">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 py-0.5 text-xs">
                      <span className="size-1.5 rounded-full bg-black/40" />
                      Scoring ready
                    </span>
                  </div>
                  <div className="mt-3 rounded-xl border border-black/10 bg-white/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Cell Structure Quiz</span>
                      <span className="rounded-md bg-amber-300/80 px-2 py-0.5 text-xs font-medium">Quiz</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-black/60">
                      Twelve multiple-choice questions covering organelles, membrane transport, and cell division —
                      with instant feedback on every answer.
                    </p>
                    <div className="mt-2 text-xs text-black/50">Ready to start</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <p className="landing-quote mx-auto mt-8 max-w-xl pb-10 text-center font-serif text-xl leading-snug text-balance text-black/80 md:text-2xl">
            The best study sessions are the ones you don&apos;t have to plan yourself.
          </p>

          <PricingSection />
          <FaqSection />
        </div>
      </div>

      <div className="landing-footer">
        <Footer />
      </div>
    </main>
  );
}
