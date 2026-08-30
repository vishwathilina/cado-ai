import Link from "next/link";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5">
      <div className="max-w-[1280px] mx-auto px-6 flex h-16 items-center justify-between">
        <Link
          href="/"
          className="font-serif text-xl font-medium tracking-tight rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
        >
          Cado AI
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/#pricing"
            className="hidden sm:inline-block text-sm text-black/70 hover:text-black px-3 py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-neutral-100 px-4 py-2 text-sm hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-black text-white px-4 py-2 text-sm hover:bg-black/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
