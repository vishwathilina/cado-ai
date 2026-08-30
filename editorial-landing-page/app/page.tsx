import Image from "next/image"
import { Paperclip, ArrowUp, PlayCircle, Check, Globe } from "lucide-react"
import { FeatureGrid } from "@/components/feature-grid"
import { SideNav } from "@/components/side-nav"
import { Footer } from "@/components/footer"
import { FaqSection } from "@/components/faq-section"

export default function Page() {
  return (
    <main id="top" className="min-h-screen bg-white text-[#0A0A0A]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-black focus:text-white focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      {/* Sticky header — full width, neutral chrome */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5">
        <div className="max-w-[1280px] mx-auto px-6 flex h-16 items-center justify-between">
          <a
            href="#top"
            className="font-serif text-xl font-medium tracking-tight rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
          >
            Cofounder
          </a>
          <div className="flex items-center gap-2">
            <a
              href="#"
              className="hidden sm:inline-block text-sm text-black/70 hover:text-black px-3 py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
            >
              Pricing
            </a>
            <a
              href="#"
              className="rounded-full bg-neutral-100 px-4 py-2 text-sm hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
            >
              Log in
            </a>
            <a
              href="#"
              className="rounded-full bg-black text-white px-4 py-2 text-sm hover:bg-black/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
            >
              Sign up
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-12">
        {/* Left rail */}
        <aside className="hidden md:block">
          <SideNav />
        </aside>

        {/* Main column */}
        <div id="main-content" className="min-w-0">
          {/* Hero */}
          <section
            id="product"
            className="pt-20 pb-32 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 items-center scroll-mt-20"
          >
            <div>
              <h1 className="font-serif text-7xl md:text-8xl leading-[1.02] font-medium tracking-tight text-balance">
                Software that
                <br />
                tends itself
              </h1>
              <p className="mt-8 max-w-md text-sm text-black/60 leading-relaxed">
                Describe what you want in plain English. Cofounder plants the automation across the tools you
                already use — Linear, Notion, Slack, Gmail — and quietly keeps it growing.
              </p>
              <a
                href="#"
                className="mt-6 inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
              >
                <PlayCircle className="size-4" />
                Watch our launch video
              </a>
            </div>
            <div className="hidden lg:block relative size-[360px] rounded-2xl overflow-hidden bg-black">
              <Image
                src="/pixel-automation.png"
                alt="Pixel art CRT showing the message Software that tends itself, surrounded by gears, sparkles, mail, calendar, a checkmark, a seedling and a sunflower"
                fill
                className="object-contain"
                sizes="360px"
                priority
              />
            </div>
          </section>

          {/* First pixel-art band */}
          <section id="use-cases" className="mt-16 scroll-mt-20">
            <div className="mb-8 flex items-end justify-between gap-6">
              <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-balance max-w-md">
                Plant a prompt. Watch it grow.
              </h2>
              <p className="hidden md:block text-sm text-black/60 max-w-xs leading-relaxed">
                One sentence is enough. Cofounder figures out the steps, the tools, and the schedule.
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
                    Every day research my competitors and dm me on slack
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

          {/* Feature grid */}
          <section id="command-center" className="py-32 scroll-mt-20">
            <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-center text-balance">
              A season&apos;s worth of things Cofounder can do
            </h2>
            <p className="mt-3 text-center text-sm text-black/60 max-w-md mx-auto leading-relaxed">
              Each one started as a single sentence. None of them need watching.
            </p>
            <FeatureGrid />
          </section>

          {/* Second pixel-art band */}
          <section id="agents" className="mt-16 scroll-mt-20">
            <div className="mb-8 flex items-end justify-between gap-6">
              <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-balance max-w-md">
                From a single seed to a finished release
              </h2>
              <p className="hidden md:block text-sm text-black/60 max-w-xs leading-relaxed">
                Close an issue in Linear. Cofounder writes the release note in Notion. The loop closes itself.
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
                  <div className="font-semibold text-sm">Linear Issue Closed to Notion Release Notes</div>
                  <div className="flex flex-wrap gap-2 mt-3 opacity-50">
                    {[
                      "Implement a user profile page",
                      "Add scroll",
                      "Edit error message",
                      "Filter displayed issues by tag",
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
                      Adding content to Notion page <span className="text-black/50">· Completed</span>
                    </span>
                  </div>
                  <div className="mt-2 ml-6">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-black/10 px-2.5 py-0.5 text-xs">
                      <span className="size-1.5 rounded-full bg-black/40" />
                      Adding text
                    </span>
                  </div>
                  <div className="mt-3 rounded-xl bg-white/60 border border-black/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">Implement a User Profile Page</span>
                      <span className="bg-amber-300/80 rounded-md px-2 py-0.5 text-xs font-medium">Feature</span>
                    </div>
                    <p className="mt-1 text-xs text-black/60 leading-relaxed">
                      Develop a responsive user profile page allowing users to view and edit their personal
                      information, upload an avatar image, and manage privacy settings.
                    </p>
                    <div className="mt-2 text-xs text-black/50">Completed on 2025-12-16</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Caption */}
          <p className="mt-10 text-center font-serif text-xl md:text-2xl text-black/80 max-w-xl mx-auto pb-24 text-balance leading-snug">
            The best software is the kind you stop having to think about.
          </p>

          <FaqSection />
        </div>
      </div>

      <Footer />
    </main>
  )
}
