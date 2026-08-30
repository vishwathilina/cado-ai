import Image from "next/image"
import { ArrowUp, ArrowUpRight } from "lucide-react"

const marqueeItems = [
  "Plant a prompt",
  "Watch it grow",
  "Software that tends itself",
  "Linear",
  "Notion",
  "Slack",
  "Gmail",
  "Built for operators",
  "Natural language automation",
]

const linkColumns = [
  {
    title: "Product",
    links: [
      { label: "Use cases", href: "#use-cases" },
      { label: "Command Center", href: "#command-center" },
      { label: "Agents", href: "#agents" },
      { label: "Pricing", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press kit", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "Changelog", href: "#" },
      { label: "Community", href: "#" },
      { label: "Support", href: "#" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="relative mt-32 overflow-hidden border-t border-black/8 bg-white">
      {/* Marquee strip */}
      <div className="border-b border-black/8 bg-neutral-50/60 py-4">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap text-xs font-medium uppercase tracking-[0.25em] text-black/50">
          {[...marqueeItems, ...marqueeItems].map((item, idx) => (
            <span key={idx} className="flex items-center gap-12">
              {item}
              <span className="text-black/20" aria-hidden="true">
                ✦
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Main footer body */}
      <div className="relative max-w-[1280px] mx-auto px-6 pt-24 pb-12">
        {/* CTA block */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 items-end pb-20 border-b border-black/8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-black/50 mb-6">Get started</p>
            <h2 className="font-serif text-5xl md:text-7xl font-medium tracking-tight leading-[1.02] text-balance max-w-2xl">
              Plant your first
              <br />
              automation today.
            </h2>
            <p className="mt-6 max-w-md text-sm text-black/60 leading-relaxed">
              One sentence is all it takes. Cofounder figures out the steps, the tools, and the schedule.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="#"
              className="group inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition-all hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
            >
              Start free
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-medium text-black transition-all hover:border-black/30 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
            >
              Talk to us
            </a>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 py-16">
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <div className="relative size-12">
              <Image src="/sunflower.jpg" alt="" fill className="object-contain" sizes="48px" />
            </div>
            <p className="font-serif text-xl font-medium tracking-tight">Cofounder</p>
            <p className="text-sm text-black/60 leading-relaxed max-w-[220px]">
              Software that tends itself.
            </p>
          </div>
          {linkColumns.map((col) => (
            <div key={col.title} className="flex flex-col gap-4">
              <p className="text-xs uppercase tracking-[0.2em] text-black/50">{col.title}</p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-black/70 transition-colors hover:text-black focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Giant brand wordmark */}
        <div
          aria-hidden="true"
          className="select-none pointer-events-none overflow-hidden -mx-6 px-6"
        >
          <p className="font-serif font-medium tracking-tight leading-[0.85] text-[20vw] text-balance bg-gradient-to-b from-black/10 to-transparent bg-clip-text text-transparent">
            Cofounder
          </p>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-black/8">
          <p className="text-xs uppercase tracking-[0.2em] text-black/50 order-2 md:order-1">
            &copy; 2026 Cofounder. All rights reserved.
          </p>

          <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 order-1 md:order-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-black/50">Tended with care in</span>
            <span className="text-xs font-medium text-black">San Francisco</span>
          </div>

          <a
            href="#top"
            aria-label="Back to top"
            className="group order-3 inline-flex size-10 items-center justify-center rounded-full border border-black/10 bg-white text-black/60 transition-all hover:border-black/30 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
          >
            <ArrowUp className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </footer>
  )
}
