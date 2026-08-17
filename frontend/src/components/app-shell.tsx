"use client";

import {
  Cancel01Icon,
  CloudUploadIcon,
  DashboardSquare01Icon,
  Logout01Icon,
  Menu01Icon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/cado-buddy";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api";

const links = [
  { href: "/dashboard", label: "Today", icon: DashboardSquare01Icon },
  { href: "/upload", label: "Upload", icon: CloudUploadIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r bg-[var(--surface)] p-5">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/dashboard" onClick={() => setOpen(false)}>
          <BrandMark />
        </Link>
        <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <Icon icon={Cancel01Icon} />
        </button>
      </div>
      <nav className="space-y-2">
        {links.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 font-semibold transition ${
                active ? "bg-[var(--primary)] text-white" : "muted hover:bg-[var(--surface-2)]"
              }`}
            >
              <Icon icon={icon} size={19} />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="muted mt-8 text-xs leading-5">1. Upload notes · 2. Learn · 3. Quiz · 4. Check the plan</p>
      <div className="mt-auto space-y-1">
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-semibold hover:bg-[var(--surface-2)]"
        >
          {resolvedTheme === "dark" ? <Icon icon={Sun03Icon} size={19} /> : <Icon icon={Moon02Icon} size={19} />}
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button
          onClick={logout}
          className="muted flex w-full items-center gap-3 rounded-xl px-4 py-3 font-semibold hover:bg-[var(--surface-2)]"
        >
          <Icon icon={Logout01Icon} size={19} /> Log out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[18rem_1fr]">
      <div className="fixed inset-y-0 left-0 z-40 hidden md:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-72" onClick={(event) => event.stopPropagation()}>{sidebar}</div>
        </div>
      )}
      <div className="md:col-start-2">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-[color:var(--background)]/90 px-5 backdrop-blur md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu"><Icon icon={Menu01Icon} /></button>
          <span className="ml-3 font-extrabold">Cado AI</span>
        </header>
        <main className="mx-auto max-w-6xl p-5 md:p-9">{children}</main>
      </div>
    </div>
  );
}
