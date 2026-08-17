"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark, CadoBuddy } from "@/components/cado-buddy";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
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
      router.push("/dashboard");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="stars grid min-h-screen items-center gap-10 p-5 lg:grid-cols-[.9fr_1fr] lg:px-16">
      <div className="hidden justify-center lg:flex">
        <CadoBuddy
          size={340}
          message={mode === "login" ? "Welcome back. The trail is still warm." : "New pack, same buddy. Let’s start walking."}
        />
      </div>
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center lg:justify-start">
          <BrandMark />
        </Link>
        <form onSubmit={submit} className="card space-y-5 p-7">
          <div>
            <h1 className="text-2xl font-extrabold">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="muted mt-1 text-sm">
              {mode === "login" ? "Cado saved your spot." : "Study smarter from day one."}
            </p>
          </div>
          {mode === "register" && (
            <label className="block text-sm font-bold">
              Name
              <input name="name" required minLength={2} className="field mt-2 font-normal" />
            </label>
          )}
          <label className="block text-sm font-bold">
            Email
            <input name="email" type="email" required className="field mt-2 font-normal" />
          </label>
          <label className="block text-sm font-bold">
            Password
            <input name="password" type="password" required minLength={8} className="field mt-2 font-normal" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</p>}
          <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Get started"} <Icon icon={ArrowRight01Icon} size={17} />
          </button>
          <p className="muted text-center text-sm">
            {mode === "login" ? "New to Cado?" : "Already have an account?"}{" "}
            <Link className="font-bold text-[var(--primary)]" href={mode === "login" ? "/register" : "/login"}>
              {mode === "login" ? "Create account" : "Sign in"}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
