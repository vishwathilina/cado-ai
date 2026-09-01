import Link from "next/link";
import { Check } from "lucide-react";
import { ScrollFillHeading } from "@/components/landing/scroll-fill-heading";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything you need to turn a first set of notes into a study session.",
    cta: "Start free",
    href: "/register",
    featured: false,
    features: [
      "3 study sets per month",
      "Explanations and flashcards",
      "Scored quizzes with feedback",
      "Seven-day study plan",
      "Dashboard and streak tracking",
    ],
  },
  {
    name: "Pro",
    price: "$12",
    period: "per month",
    description: "For students who upload often and want the full tutor and history.",
    cta: "Get Pro",
    href: "/register",
    featured: true,
    features: [
      "Unlimited study sets",
      "Notes tutor with citations",
      "Section images and mind maps",
      "Weak-topic review on dashboard",
      "Priority processing",
      "Export quiz history",
    ],
  },
  {
    name: "Classroom",
    price: "$29",
    period: "per month",
    description: "For teachers and study groups sharing sets across a class.",
    cta: "Contact us",
    href: "mailto:hello@cado.ai",
    featured: false,
    features: [
      "Everything in Pro",
      "Shared class library",
      "Multiple student seats",
      "Bulk upload support",
      "Usage overview for educators",
      "Email support",
    ],
  },
];

export function PricingSection() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="pt-12 pb-20 scroll-mt-20">
      <header className="section-heading max-w-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-black/50">Pricing</p>
        <ScrollFillHeading
          id="pricing-heading"
          className="mt-3 font-serif text-3xl md:text-5xl font-medium tracking-tight text-balance leading-[1.02]"
        >
          Simple plans for serious studying.
        </ScrollFillHeading>
        <p className="mt-6 text-sm text-black/60 leading-relaxed max-w-lg">
          Start free with uploads, learn mode, quizzes, and a weekly plan. Upgrade when you want
          unlimited sets, the notes tutor, and classroom sharing.
        </p>
      </header>

      <div className="pricing-grid mt-14 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`pricing-card rounded-2xl border p-6 flex flex-col ${
              plan.featured ? "border-black bg-black text-white" : "border-black/8 bg-white"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-serif text-2xl font-medium">{plan.name}</h3>
              {plan.featured && (
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide">
                  Popular
                </span>
              )}
            </div>
            <p className={`mt-3 text-sm leading-relaxed ${plan.featured ? "text-white/70" : "text-black/60"}`}>
              {plan.description}
            </p>
            <div className="mt-6 flex items-end gap-1">
              <span className="font-serif text-4xl font-medium">{plan.price}</span>
              <span className={`pb-1 text-sm ${plan.featured ? "text-white/60" : "text-black/50"}`}>
                {plan.period}
              </span>
            </div>
            <ul className={`mt-6 flex-1 space-y-3 text-sm ${plan.featured ? "text-white/85" : "text-black/70"}`}>
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className={`size-4 shrink-0 mt-0.5 ${plan.featured ? "text-white" : "text-black"}`} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link
              href={plan.href}
              className={`mt-8 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                plan.featured
                  ? "bg-white text-black hover:bg-white/90 focus-visible:ring-white/40"
                  : "bg-black text-white hover:bg-black/90 focus-visible:ring-black/40"
              }`}
            >
              {plan.cta}
            </Link>
          </article>
        ))}
      </div>

      <p className="mt-12 text-sm text-black/50 max-w-xl leading-relaxed">
        All plans include explanations, flashcards, quizzes, and a study plan. Prices shown in USD.
        Classroom pricing scales with seat count — email{" "}
        <a href="mailto:hello@cado.ai" className="text-black underline-offset-4 hover:underline">
          hello@cado.ai
        </a>{" "}
        for a quote.
      </p>
    </section>
  );
}
