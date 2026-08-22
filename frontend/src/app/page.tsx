import {
  ArrowRight01Icon,
  BookOpenCheckIcon,
  BrainIcon,
  CloudUploadIcon,
  TranslateIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { BrandMark, CadoBuddy } from "@/components/cado-buddy";
import { Icon } from "@/components/icon";
import { FadeIn, PageTransition } from "@/components/page-transition";

const steps = [
  { icon: CloudUploadIcon, title: "1. Upload", copy: "Drop a PDF, PPTX, TXT, or a photo of your notes." },
  { icon: BrainIcon, title: "2. Learn", copy: "Read short explanations and flip flashcards." },
  { icon: BookOpenCheckIcon, title: "3. Quiz", copy: "Tap an answer. See green, red, and why." },
  { icon: TranslateIcon, title: "4. Plan", copy: "Follow a seven-day trail Cado builds for you." },
];

export default function Home() {
  return (
    <PageTransition>
    <main className="stars min-h-screen overflow-hidden">
      <nav className="mx-auto flex max-w-6xl items-center justify-between p-6">
        <BrandMark />
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 font-bold">Sign in</Link>
          <Link href="/register" className="btn-primary">Start learning</Link>
        </div>
      </nav>
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-8 md:grid-cols-[1.1fr_.9fr] md:pt-12">
        <div>
          <p className="mb-5 w-fit rounded-full border bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">
            Notes in. A study session out.
          </p>
          <h1 className="font-display max-w-3xl text-5xl font-semibold leading-[1.08] md:text-6xl">
            A buddy, a plan, and quizzes that talk back.
          </h1>
          <p className="muted mt-6 max-w-xl text-lg leading-8">
            Cado reads your notes, then walks you through explanations, flashcards, and a scored quiz —
            with a week-long plan so you always know what’s next.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary px-6 py-4 text-lg">Create my study hub <Icon icon={ArrowRight01Icon} /></Link>
            <Link href="/login" className="btn-secondary px-6 py-4 text-lg">I already have an account</Link>
          </div>
        </div>
        <CadoBuddy size={340} message="Upload → Learn → Quiz. I’ll keep the map." />
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-4">
        {steps.map(({ icon, title, copy }, index) => (
          <FadeIn key={title} delay={0.08 + index * 0.06}>
            <article className="card p-5">
              <Icon icon={icon} className="mb-4 text-[var(--primary)]" />
              <h2 className="font-extrabold">{title}</h2>
              <p className="muted mt-2 text-sm leading-6">{copy}</p>
            </article>
          </FadeIn>
        ))}
      </section>
    </main>
    </PageTransition>
  );
}
