const faqs = [
  {
    q: "What is Cado AI?",
    a: "Cado AI turns your notes into a full study session — explanations, flashcards, scored quizzes, and a seven-day plan. Upload a PDF, slides, or a photo and Cado structures the material so you can learn and review without starting from scratch.",
  },
  {
    q: "What file types can I upload?",
    a: "PDF, PPTX, TXT, and images of handwritten or printed notes. Cado extracts the text, maps sections, and builds learn mode, flashcards, and quiz questions from your material.",
  },
  {
    q: "How does the study plan work?",
    a: "After you upload, Cado generates a seven-day trail with daily tasks. You can drag tasks, mark them complete, run focus timers, and track how many minutes you studied today.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. The free plan includes uploads, explanations, flashcards, quizzes, and a weekly study plan. See our pricing page for Pro and Classroom options.",
  },
]

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-24 scroll-mt-20">
      <div className="mx-auto max-w-3xl">
        <header className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-black/50">Questions</p>
          <h2
            id="faq-heading"
            className="mt-3 font-serif text-3xl md:text-4xl font-medium tracking-tight text-balance"
          >
            Frequently asked questions
          </h2>
        </header>
        <dl className="divide-y divide-black/10 border-y border-black/10">
          {faqs.map((item) => (
            <div key={item.q} className="py-6">
              <dt className="font-semibold text-base leading-snug text-balance">{item.q}</dt>
              <dd className="mt-2 text-sm text-black/65 leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
