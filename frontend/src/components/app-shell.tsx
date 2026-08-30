"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Cancel01Icon,
  Clock01Icon,
  CloudUploadIcon,
  DashboardSquare01Icon,
  Logout01Icon,
  Menu01Icon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { useTheme } from "@/components/theme-provider";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { BrandMark } from "@/components/cado-buddy";
import { Icon } from "@/components/icon";
import { pageEase } from "@/components/page-transition";
import { themeToggleOrigin } from "@/lib/theme-transition";
import { api } from "@/lib/api";

const links = [
  { href: "/dashboard", label: "Today", icon: DashboardSquare01Icon },
  { href: "/upload", label: "Upload", icon: CloudUploadIcon },
  { href: "/history", label: "History", icon: Clock01Icon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const quiz = pathname.startsWith("/quiz");
  const dashboard = pathname === "/dashboard";
  const editorial = pathname === "/upload" || pathname === "/history";
  const glassScene = dashboard || editorial;

  function onToggleTheme(event: MouseEvent<HTMLButtonElement>) {
    toggleTheme(themeToggleOrigin(event));
  }

  const glassRail = (
    <aside className="app-rail-glass flex h-full w-[4.75rem] flex-col items-center py-5">
      <Link href="/dashboard" className="mb-8" aria-label="Cado AI">
        <BrandMark compact />
      </Link>
      <nav className="flex flex-col items-center gap-2">
        {links.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={`nav-rail-item ${active ? "is-active" : ""}`}
            >
              <Icon icon={icon} size={20} />
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          onClick={onToggleTheme}
          className="nav-rail-item theme-toggle-btn"
          aria-label={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          title={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        >
          {resolvedTheme === "dark" ? <Icon icon={Sun03Icon} size={20} /> : <Icon icon={Moon02Icon} size={20} />}
        </button>
        <button onClick={logout} className="nav-rail-item" aria-label="Log out" title="Log out">
          <Icon icon={Logout01Icon} size={20} />
        </button>
      </div>
    </aside>
  );

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const rail = (
    <aside className="flex h-full w-[4.75rem] flex-col items-center border-r bg-[var(--surface)] py-5">
      <Link href="/dashboard" className="mb-8" aria-label="Cado AI">
        <BrandMark compact />
      </Link>
      <nav className="flex flex-col items-center gap-2">
        {links.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={`nav-rail-item ${active ? "is-active" : ""}`}
            >
              <Icon icon={icon} size={20} />
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          onClick={onToggleTheme}
          className="nav-rail-item theme-toggle-btn"
          aria-label={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          title={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        >
          {resolvedTheme === "dark" ? <Icon icon={Sun03Icon} size={20} /> : <Icon icon={Moon02Icon} size={20} />}
        </button>
        <button onClick={logout} className="nav-rail-item" aria-label="Log out" title="Log out">
          <Icon icon={Logout01Icon} size={20} />
        </button>
      </div>
    </aside>
  );

  const drawer = (
    <aside className="flex h-full w-64 flex-col border-r bg-[var(--surface)] px-3 py-5">
      <div className="mb-8 flex items-center justify-between px-2">
        <Link href="/dashboard" onClick={() => setOpen(false)}>
          <BrandMark />
        </Link>
        <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <Icon icon={Cancel01Icon} />
        </button>
      </div>
      <nav className="space-y-1">
        {links.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={`nav-item ${active ? "is-active" : ""}`}>
              <Icon icon={icon} size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-1">
        <button
          onClick={onToggleTheme}
          className="nav-item theme-toggle-btn w-full"
        >
          {resolvedTheme === "dark" ? <Icon icon={Sun03Icon} size={18} /> : <Icon icon={Moon02Icon} size={18} />}
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button onClick={logout} className="nav-item w-full">
          <Icon icon={Logout01Icon} size={18} /> Log out
        </button>
      </div>
    </aside>
  );

  if (quiz) {
    return <div className="h-dvh overflow-hidden bg-[var(--background)]">{children}</div>;
  }

  return (
    <div className={`min-h-screen ${glassScene ? "app-shell-glass" : ""} ${editorial ? "app-shell-editorial" : ""}`}>
      <div className="fixed inset-y-0 left-0 z-40 hidden md:block">
        {glassScene ? glassRail : rail}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/30 md:hidden"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="h-full w-64"
              onClick={(event) => event.stopPropagation()}
              initial={{ x: -24, opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -16, opacity: 0 }}
              transition={{ duration: 0.28, ease: pageEase }}
            >
              {drawer}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="md:pl-[4.75rem]">
        <header className={`sticky top-0 z-30 flex h-14 items-center border-b px-5 md:hidden ${glassScene ? "app-mobile-header" : "bg-[var(--background)]/90 backdrop-blur"}`}>
          <button onClick={() => setOpen(true)} aria-label="Open menu"><Icon icon={Menu01Icon} /></button>
          <span className="font-display ml-3 font-semibold">Cado AI</span>
        </header>
        <main className={glassScene ? "app-main-glass min-h-[calc(100vh-3.5rem)] md:min-h-screen" : "mx-auto max-w-6xl p-5 md:p-9"}>
          {children}
        </main>
      </div>
    </div>
  );
}
