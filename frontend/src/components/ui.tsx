import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
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
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="kicker">{kicker}</p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {subtitle && <p className="muted mt-2 max-w-2xl leading-7">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Steps({ current, items }: { current: number; items: string[] }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {items.map((item, index) => {
        const state = index < current ? "done" : index === current ? "now" : "todo";
        return (
          <li key={item} className={`step-chip ${state}`}>
            <span>{index + 1}</span>
            {item}
          </li>
        );
      })}
    </ol>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div>
      {label && <p className="muted mb-2 text-xs font-bold uppercase tracking-widest">{label}</p>}
      <div className="progress-track" role="progressbar" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  copy,
  href,
  cta,
}: {
  title: string;
  copy: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="soft rounded-2xl p-6 text-center">
      <p className="font-extrabold">{title}</p>
      <p className="muted mt-1 text-sm leading-6">{copy}</p>
      <Link href={href} className="btn-primary mt-4 py-2 text-sm">
        {cta}
      </Link>
    </div>
  );
}
