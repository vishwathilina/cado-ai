import Image from "next/image"
import Link from "next/link"
import { Paperclip, ArrowUp, PlayCircle, Check, Globe } from "lucide-react"
import { FeatureGrid } from "@/components/feature-grid"
import { SideNav } from "@/components/side-nav"
import { Footer } from "@/components/footer"
import { FaqSection } from "@/components/faq-section"
import { MarketingHeader } from "@/components/marketing-header"
import { PricingSection } from "@/components/pricing-section"

export default function Page() {
  return (
    <main id="top" className="min-h-screen bg-white text-[#0A0A0A]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-black focus:text-white focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <MarketingHeader />

      <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-12">
        <aside className="hidden md:block">
          <SideNav />
        </aside>

        <div id="main-content" className="min-w-0">
          <section
            id="product"
            className="pt-20 pb-32 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 items-center scroll-mt-20"
          >
            <div>
              <h1 className="font-serif text-7xl md:text-8xl leading-[1.02] font-medium tracking-tight text-balance">
                Notes that
                <br />
                study themselves
              </h1>
              <p className="mt-8 max-w-md text-sm text-black/60 leading-relaxed">
                Upload your PDFs, slides, or photos. Cado builds explanations, flashcards, scored quizzes,
                and a seven-day plan — so you always know what to study next.
              </p>
              <Link
                href="/register"
                className="mt-6 inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
              >
                <PlayCircle className="size-4" />
                See how Cado works
              </Link>
            </div>
            <div className="hidden lg:block relative size-[360px] rounded-2xl overflow-hidden bg-black">
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
            <div className="mb-8 flex items-end justify-between gap-6">
              <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-balance max-w-md">
                Upload once. Study all week.
              </h2>
              <p className="hidden md:block text-sm text-black/60 max-w-xs leading-relaxed">
                One file is enough. Cado figures out the sections, the cards, and the quiz.
              </p>
            </div>
            <div className="relative aspect-[21/9] rounded-3xl overflow-hidden">
              <Image
                src="/pixel-landscape.jpg"
                alt="Pixel art landscape with sunflowers, mountains, and a lake"
                fill
                className="object-cover"
                sizes="(min-width: 768px) 78vw, 100vw"
              />
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <div className="backdrop-blur-xl bg-white/60 border border-white/40 rounded-2xl shadow-xl flex items-center justify-between p-5 w-[min(560px,100%)] gap-4">
                  <Paperclip className="size-5 text-black/50 shrink-0" />
                  <span className="flex-1 text-[15px] text-black/70 truncate">
                    Turn my biology notes into flashcards and a quiz
                  </span>
                  <button
                    type="button"
                    aria-label="Send"
                    className="size-10 rounded-full bg-black text-white flex items-center justify-center shrink-0 hover:bg-black/90 transition-colors"
                  >
                    <ArrowUp className="size-5" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section id="command-center" className="py-32 scroll-mt-20">
            <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-center text-balance">
              A semester&apos;s worth of things Cado can do
            </h2>
            <p className="mt-3 text-center text-sm text-black/60 max-w-md mx-auto leading-relaxed">
              Each one starts with your notes. None of them need babysitting.
            </p>
            <FeatureGrid />
          </section>

          <section id="agents" className="mt-16 scroll-mt-20">
            <div className="mb-8 flex items-end justify-between gap-6">
              <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-balance max-w-md">
                From upload to quiz in one flow
              </h2>
              <p className="hidden md:block text-sm text-black/60 max-w-xs leading-relaxed">
                Upload notes. Cado builds learn mode, flashcards, and a scored quiz. The loop closes itself.
              </p>
            </div>
            <div className="relative aspect-[21/9] rounded-3xl overflow-hidden">
              <Image
                src="/pixel-meadow.jpg"
                alt="Pixel art meadow with poppies and wildflowers"
                fill
                className="object-cover"
                sizes="(min-width: 768px) 78vw, 100vw"
              />
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <div className="backdrop-blur-xl bg-white/70 border border-white/50 rounded-2xl shadow-xl p-6 w-[min(520px,100%)]">
                  <div className="font-semibold text-sm">Biology Notes to Study Session</div>
                  <div className="flex flex-wrap gap-2 mt-3 opacity-50">
                    {[
                      "Cell structure overview",
                      "Mitosis flashcards",
                      "Chapter 4 quiz",
                      "Week plan generated",
                    ].map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full bg-white/80 border border-black/10 px-3 py-1 text-xs flex items-center gap-1.5"
                      >
                        <Globe className="size-3 text-black/50" />
                        {chip}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <span className="size-4 rounded-full bg-black text-white flex items-center justify-center">
                      <Check className="size-3" />
                    </span>
                    <span>
                      Building quiz questions <span className="text-black/50">· Completed</span>
                    </span>
                  </div>
                  <div className="mt-2 ml-6">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-black/10 px-2.5 py-0.5 text-xs">
                      <span className="size-1.5 rounded-full bg-black/40" />
                      Scoring ready
                    </span>
                  </div>
                  <div className="mt-3 rounded-xl bg-white/60 border border-black/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">Cell Structure Quiz</span>
                      <span className="bg-amber-300/80 rounded-md px-2 py-0.5 text-xs font-medium">Quiz</span>
                    </div>
                    <p className="mt-1 text-xs text-black/60 leading-relaxed">
                      Twelve multiple-choice questions covering organelles, membrane transport, and cell division —
                      with instant feedback on every answer.
                    </p>
                    <div className="mt-2 text-xs text-black/50">Ready to start</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <p className="mt-10 text-center font-serif text-xl md:text-2xl text-black/80 max-w-xl mx-auto pb-24 text-balance leading-snug">
            The best study sessions are the ones you don&apos;t have to plan yourself.
          </p>

          <PricingSection />
          <FaqSection />
        </div>
      </div>

      <Footer />
    </main>
  )
}
