import { TrendingUp, AlertCircle, CheckCircle2, Inbox, Clock } from "lucide-react"

type Feature = {
  title: string
  description: string
  preview: () => React.ReactNode
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Spreadsheet analysis — rows fill in sequentially on hover
function SpreadsheetPreview() {
  const rows = [
    { co: "Linear", arr: "$48M", growth: "+142%" },
    { co: "Notion", arr: "$580M", growth: "+89%" },
    { co: "Figma", arr: "$600M", growth: "+67%" },
    { co: "Vercel", arr: "$96M", growth: "+204%" },
  ]
  return (
    <div className="absolute inset-0 p-4 font-mono text-[10px]">
      <div className="grid grid-cols-[1fr_60px_60px] gap-px bg-black/5 rounded-md overflow-hidden border border-black/5">
        <div className="bg-neutral-50 px-2 py-1 text-black/50 font-medium">Company</div>
        <div className="bg-neutral-50 px-2 py-1 text-black/50 font-medium">ARR</div>
        <div className="bg-neutral-50 px-2 py-1 text-black/50 font-medium">YoY</div>
        {rows.map((r, i) => (
          <div key={r.co} className="contents">
            <div
              className="bg-white px-2 py-1.5 transition-all duration-500"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {r.co}
            </div>
            <div
              className="bg-white px-2 py-1.5 text-black/70 opacity-0 -translate-x-1 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0"
              style={{ transitionDelay: `${i * 80 + 200}ms` }}
            >
              {r.arr}
            </div>
            <div
              className="bg-white px-2 py-1.5 text-emerald-600 opacity-0 -translate-x-1 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0"
              style={{ transitionDelay: `${i * 80 + 400}ms` }}
            >
              {r.growth}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute left-4 right-4 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-y-[80px] transition-all duration-1000 ease-out top-8" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Engineering status — issue list with sliding new item
function EngineeringPreview() {
  const items = [
    { dot: "bg-rose-500", title: "API rate limiter", status: "In review" },
    { dot: "bg-amber-500", title: "Onboarding redesign", status: "In progress" },
    { dot: "bg-emerald-500", title: "Dark mode polish", status: "Done" },
  ]
  return (
    <div className="absolute inset-0 p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[10px] text-black/50 px-1">
        <TrendingUp className="size-3" />
        <span>Sprint velocity +18%</span>
      </div>
      {items.map((item, i) => (
        <div
          key={item.title}
          className="flex items-center gap-2 rounded-md bg-white border border-black/8 px-2.5 py-1.5 transition-all duration-300 group-hover:translate-x-0"
          style={{
            transform: `translateX(0)`,
            transitionDelay: `${i * 60}ms`,
          }}
        >
          <span className={`size-1.5 rounded-full ${item.dot}`} />
          <span className="text-[11px] font-medium truncate flex-1">{item.title}</span>
          <span className="text-[9px] text-black/50">{item.status}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 opacity-0 -translate-y-2 transition-all duration-500 delay-300 group-hover:opacity-100 group-hover:translate-y-0">
        <AlertCircle className="size-3 text-amber-700 shrink-0" />
        <span className="text-[10px] font-medium text-amber-900 truncate">3 blockers need attention</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Resume — lines "type" themselves out on hover

function ResumeLines() {
  const lines = [
    { w: "70%", h: "h-2", strong: true },
    { w: "45%", h: "h-1.5", strong: false },
    { w: "0", spacer: true },
    { w: "35%", h: "h-1.5", strong: true },
    { w: "85%", h: "h-1", strong: false },
    { w: "75%", h: "h-1", strong: false },
    { w: "60%", h: "h-1", strong: false },
    { w: "0", spacer: true },
    { w: "35%", h: "h-1.5", strong: true },
    { w: "70%", h: "h-1", strong: false },
    { w: "55%", h: "h-1", strong: false },
  ]
  return (
    <div className="absolute inset-0 p-4 flex items-center justify-center">
      <div className="relative w-[130px] aspect-[3/4] bg-white rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-black/5 p-3 flex flex-col gap-1.5 group-hover:rotate-1 transition-transform duration-500">
        {lines.map((l, i) =>
          l.spacer ? (
            <div key={i} className="h-1" />
          ) : (
            <div
              key={i}
              className={`${l.h} rounded-sm ${l.strong ? "bg-black/80" : "bg-black/15"} w-0 transition-[width] duration-700 ease-out group-hover:w-[var(--target-w)]`}
              style={
                {
                  ["--target-w" as string]: l.w,
                  transitionDelay: `${i * 60}ms`,
                } as React.CSSProperties
              }
            />
          ),
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Pixel art — image transitions to pixelated on hover
function PixelArtPreview() {
  return (
    <div className="absolute inset-0 p-4 flex items-center justify-center gap-3">
      <div className="relative w-[80px] aspect-square rounded-md overflow-hidden border border-black/10 bg-gradient-to-br from-sky-300 via-amber-200 to-emerald-300">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#fbbf24_0%,transparent_50%),radial-gradient(circle_at_70%_70%,#34d399_0%,transparent_50%)]" />
      </div>
      <div className="text-black/30 text-xs font-mono">→</div>
      <div className="relative w-[80px] aspect-square rounded-md overflow-hidden border border-black/10">
        <div
          className="absolute inset-0 bg-gradient-to-br from-sky-300 via-amber-200 to-emerald-300 transition-all duration-700"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 30%, #fbbf24 0%, transparent 50%), radial-gradient(circle at 70% 70%, #34d399 0%, transparent 50%)",
          }}
        />
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          {Array.from({ length: 64 }).map((_, i) => {
            const colors = ["bg-sky-300", "bg-amber-300", "bg-emerald-300", "bg-amber-200", "bg-sky-200"]
            const c = colors[(i * 7) % colors.length]
            return (
              <div
                key={i}
                className={`${c} transition-transform duration-500`}
                style={{
                  transitionDelay: `${(i % 8) * 20 + Math.floor(i / 8) * 20}ms`,
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Inbox — emails stack and a new one slides in
function InboxPreview() {
  const emails = [
    { from: "The Pragmatic Engineer", subject: "Scaling at Anthropic", time: "9:02" },
    { from: "Stratechery", subject: "Aggregation theory in 2026", time: "8:41" },
    { from: "Hacker Newsletter", subject: "Top 10 reads this week", time: "8:14" },
  ]
  return (
    <div className="absolute inset-0 p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[10px] text-black/50 px-1 mb-0.5">
        <Inbox className="size-3" />
        <span>Monday digest · 3 new</span>
      </div>
      {emails.map((e, i) => (
        <div
          key={e.subject}
          className="flex items-center gap-2 rounded-md bg-white border border-black/8 px-2.5 py-1.5 transition-all duration-500 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          style={{
            transform: `translateY(0)`,
            transitionDelay: `${i * 80}ms`,
          }}
        >
          <span className="size-1.5 rounded-full bg-amber-500 shrink-0 group-hover:bg-amber-500 transition-colors" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-medium truncate">{e.from}</div>
            <div className="text-[9px] text-black/50 truncate">{e.subject}</div>
          </div>
          <span className="text-[9px] text-black/40">{e.time}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Calendar briefing — day view with moving "now" line
function CalendarPreview() {
  const events = [
    { time: "9:00", title: "Standup", color: "bg-sky-100 border-sky-300", h: 18, top: 10 },
    { time: "10:30", title: "Design review", color: "bg-amber-100 border-amber-300", h: 30, top: 34 },
    { time: "14:00", title: "1:1 with Sam", color: "bg-emerald-100 border-emerald-300", h: 22, top: 70 },
  ]
  return (
    <div className="absolute inset-0 p-4">
      <div className="flex items-center gap-2 text-[10px] text-black/50 mb-2">
        <Clock className="size-3" />
        <span>Today · 3 meetings · 4h focus</span>
      </div>
      <div className="relative h-[110px] rounded-md bg-neutral-50 border border-black/5 overflow-hidden">
        {[20, 40, 60, 80].map((t) => (
          <div key={t} className="absolute left-0 right-0 h-px bg-black/5" style={{ top: `${t}%` }} />
        ))}
        {events.map((e, i) => (
          <div
            key={e.title}
            className={`absolute left-2 right-2 rounded ${e.color} border px-2 py-1 transition-all duration-500 opacity-0 group-hover:opacity-100`}
            style={{
              top: `${e.top}%`,
              height: `${e.h}%`,
              transitionDelay: `${i * 100}ms`,
            }}
          >
            <div className="text-[9px] font-medium leading-tight">{e.title}</div>
            <div className="text-[8px] text-black/50">{e.time}</div>
          </div>
        ))}
        <div className="absolute left-0 right-0 h-px bg-rose-500 transition-all duration-700 ease-out" style={{ top: "30%" }}>
          <div className="absolute -left-1 -top-1 size-2 rounded-full bg-rose-500" />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const features: Feature[] = [
  {
    title: "Analyze any startup",
    description: "Run a VC-style deep dive — competitors, financials, and team — into one spreadsheet.",
    preview: SpreadsheetPreview,
  },
  {
    title: "What's going on in engineering",
    description: "A daily snapshot of your team's status, priorities, and the blockers worth knowing about.",
    preview: EngineeringPreview,
  },
  {
    title: "Resumes from what it already knows",
    description: "Generate a public-ready PDF resume from your data and online research — no contact details.",
    preview: ResumeLines,
  },
  {
    title: "Turn any image into pixel art",
    description: "Convert photos to retro pixel art with adjustable resolution and a clean palette.",
    preview: PixelArtPreview,
  },
  {
    title: "A Monday digest of the blogs you trust",
    description: "Cofounder watches your reading list and emails a weekly summary with the takeaways.",
    preview: InboxPreview,
  },
  {
    title: "Daily calendar briefing",
    description: "Each morning, a quiet summary of your day with prep notes and surfaced context.",
    preview: CalendarPreview,
  },
]

export function FeatureGrid() {
  return (
    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {features.map((f) => {
        const Preview = f.preview
        return (
          <article
            key={f.title}
            className="group relative rounded-2xl border border-black/8 bg-white overflow-hidden transition-all duration-300 hover:border-black/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5"
          >
            <div className="relative h-44 bg-gradient-to-b from-neutral-50 to-white border-b border-black/5 overflow-hidden">
              <Preview />
            </div>
            <div className="p-5">
              <h3 className="font-semibold text-[15px] leading-snug text-balance">{f.title}</h3>
              <p className="mt-1.5 text-[13px] text-black/55 leading-relaxed">{f.description}</p>
              <div className="mt-3 flex items-center gap-1.5 text-[12px] text-black/40 group-hover:text-black transition-colors">
                <span>Try this prompt</span>
                <CheckCircle2 className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
