import { Fraunces } from "next/font/google";
import type { ReactNode } from "react";
import "./editorial-app.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-editorial-serif",
});

export function EditorialAppPage({ children }: { children: ReactNode }) {
  return (
    <div className={`editorial-app ${fraunces.variable}`}>
      <div className="editorial-app__inner">{children}</div>
    </div>
  );
}

export function EditorialHero({
  kicker,
  title,
  subtitle,
  action,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        <p className="editorial-kicker">{kicker}</p>
        <h1 className="editorial-title mt-3 text-balance">{title}</h1>
        {subtitle ? <p className="editorial-lead mt-4">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function EditorialSteps({ current, items }: { current: number; items: string[] }) {
  return (
    <ol className="editorial-steps">
      {items.map((item, index) => {
        const state = index < current ? "is-done" : index === current ? "is-now" : "";
        return (
          <li key={item} className={`editorial-step ${state}`}>
            <span>{index + 1}</span>
            {item}
          </li>
        );
      })}
    </ol>
  );
}
