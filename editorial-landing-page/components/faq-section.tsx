const faqs = [
  {
    q: "What is Cofounder?",
    a: "Cofounder is a natural-language automation tool for knowledge workers. You describe what you want in plain English and Cofounder writes the automation, runs it across your existing tools, and keeps it maintained — no triggers to configure, no agents to babysit.",
  },
  {
    q: "Which tools does Cofounder integrate with?",
    a: "Cofounder plugs into the software knowledge teams already use, including Linear, Notion, Slack, and Gmail. Automations are written once in plain English and executed natively across those tools.",
  },
  {
    q: "How is Cofounder different from Zapier or n8n?",
    a: "Zapier and n8n require you to manually define triggers, actions, and field mappings. Cofounder takes one English sentence — for example, “Every Monday, email me a digest of new posts from these tech blogs” — and produces, schedules, and maintains the automation for you.",
  },
  {
    q: "Do I need to be technical to use Cofounder?",
    a: "No. Cofounder is designed for founders, operators, and small teams. If you can describe the outcome you want, Cofounder handles the steps, the tools, and the schedule.",
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
