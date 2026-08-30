"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Icon } from "@/components/icon";
import { LoadingOverlay } from "@/components/page-transition";
import { MarketingHeader } from "@/components/marketing-header";
import { api } from "@/lib/api";
import { safeQuizNext } from "@/lib/next-path";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  return (
    <Suspense>
      <AuthFormInner mode={mode} />
    </Suspense>
  );
}

function AuthFormInner({ mode }: { mode: "login" | "register" }) {
  const searchParams = useSearchParams();
  const next = safeQuizNext(searchParams.get("next"));
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          ...(mode === "register" ? { name: form.get("name") } : {}),
        }),
      });
      window.location.replace(next || "/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-[#0A0A0A]">
      <MarketingHeader />

      <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-16 lg:py-24">
        <div className="hidden lg:flex justify-center">
          <div className="relative size-[360px] rounded-2xl overflow-hidden bg-black">
            <Image
              src="/pixel-automation.png"
              alt=""
              fill
              className="object-contain"
              sizes="360px"
              priority
            />
          </div>
        </div>

        <div className="relative w-full max-w-md mx-auto lg:mx-0 lg:max-w-lg">
          <AnimatePresence>
            {loading && (
              <LoadingOverlay
                className="auth-loading-overlay"
                label={mode === "login" ? "Signing you in…" : "Creating your account…"}
              />
            )}
          </AnimatePresence>
          <p className="text-xs uppercase tracking-[0.18em] text-black/50">
            {mode === "login" ? "Welcome back" : "Get started"}
          </p>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
            {mode === "login" ? "Sign in to Cado" : "Create your account"}
          </h1>
          <p className="mt-4 text-sm text-black/60 leading-relaxed">
            {mode === "login"
              ? "Pick up where you left off — your study sets, plans, and progress are waiting."
              : "Upload notes once. Get explanations, flashcards, quizzes, and a weekly plan."}
          </p>

          <form onSubmit={submit} className="mt-10 space-y-5">
            {mode === "register" && (
              <label className="block">
                <span className="text-sm font-medium text-black/80">Name</span>
                <input
                  name="name"
                  required
                  minLength={2}
                  className="auth-field mt-2"
                  autoComplete="name"
                />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-medium text-black/80">Email</span>
              <input
                name="email"
                type="email"
                required
                className="auth-field mt-2"
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-black/80">Password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="auth-field mt-2"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-black/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              {!loading && <Icon icon={ArrowRight01Icon} size={17} />}
            </button>

            <p className="text-center text-sm text-black/60">
              {mode === "login" ? "New to Cado?" : "Already have an account?"}{" "}
              <Link
                href={mode === "login" ? `/register${nextQuery}` : `/login${nextQuery}`}
                className="font-medium text-black underline-offset-4 hover:underline"
              >
                {mode === "login" ? "Create account" : "Sign in"}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
