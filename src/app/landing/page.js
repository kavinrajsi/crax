import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LEGAL, POLICIES } from "@/lib/legal"
import { CheckCircleIcon, KanbanSquareIcon, HistoryIcon, PaletteIcon, UploadIcon, SmartphoneIcon, BarChart3Icon } from "lucide-react"

export const metadata = {
  title: "Crax · Close more deals with a CRM you can shape",
  description: "Custom pipelines, a full audit trail and a phone-friendly CRM for small and mid-size sales teams.",
}

const BENEFITS = [
  {
    icon: KanbanSquareIcon,
    title: "Pipelines that match your process",
    text: "Create as many pipelines as you need, with your own stages and colours. Move a lead to another pipeline in one click.",
  },
  {
    icon: HistoryIcon,
    title: "Know who did what",
    text: "Every change is logged. Notes stay with their author, and edits are tracked, so nothing gets lost between reps.",
  },
  {
    icon: BarChart3Icon,
    title: "See the numbers at a glance",
    text: "The dashboard shows status and source breakdowns, new contacts over time and the leads that need attention.",
  },
  {
    icon: UploadIcon,
    title: "Bring your data in",
    text: "Import contacts from a CSV, map the columns, and export whenever you need. Your data stays yours.",
  },
  {
    icon: SmartphoneIcon,
    title: "Work from your phone",
    text: "A layout built for small screens, with a bottom tab bar and a pipeline you can swipe through stage by stage.",
  },
  {
    icon: PaletteIcon,
    title: "Tags your team recognises",
    text: "Colour-code sources and pipelines your way. Each person saves their own colours.",
  },
]

const STEPS = [
  { title: "Sign up", text: "Create your account in under a minute." },
  { title: "Shape your pipeline", text: "Set your stages, or start with the default sales stages." },
  { title: "Add your leads", text: "Import a CSV or add leads by hand. Forms can send leads in automatically." },
  { title: "Close deals", text: "Move leads through stages, log notes and watch the dashboard update." },
]

const CHECKS = [
  "Custom pipelines and stages",
  "Timeline notes with author-only editing",
  "Full audit log of changes",
  "CSV import and export",
  "Lead intake from your website forms",
  "Dashboard with status and source breakdowns",
]

const FAQS = [
  {
    q: "Can we set our own pipeline stages?",
    a: "Yes. Create pipelines and stages from Settings, pick each stage's name and colour, and move leads between pipelines whenever your process changes.",
  },
  {
    q: "How do we know who changed a lead?",
    a: "Every change is written to an audit log with the user, time and IP address. Timeline notes keep their author, and only that author can edit them.",
  },
  {
    q: "Can we bring in our existing contacts?",
    a: "Yes. Import a CSV, map its columns to contact fields, and review a preview before anything is saved. You can export your contacts at any time.",
  },
  {
    q: "Does it work on a phone?",
    a: "Yes. The app has a layout for small screens with a bottom tab bar, and pipeline stages swipe sideways so you can move through them one at a time.",
  },
  {
    q: "Can leads arrive from our website?",
    a: "Yes. Forms on your site can send submissions into Crax, and they appear as new leads in your pipeline.",
  },
  {
    q: "Does Crax connect to our email or calendar?",
    a: "Not yet. Email and calendar integrations are not built, so log activity in the app for now.",
  },
  {
    q: "How is our data stored?",
    a: "Your data is kept in a hosted Postgres database. Access requires a signed-in account, and changes are logged. See the Privacy Policy for the full details.",
  },
  {
    q: "What does it cost?",
    a: "Pricing is set when we talk to you. Use the Talk to sales button and we will send you the details.",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-semibold">{LEGAL.appName}</span>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Log in</Link>
            <Button size="sm" render={<Link href="/signup" />}>Get started</Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 pb-16 pt-16 md:pt-24">
          <p className="rounded-full border px-3 py-1 text-xs text-muted-foreground">Built for small and mid-size sales teams</p>
          <h1 className="font-heading text-[40px] font-bold leading-[1.05] tracking-tight md:text-6xl">
            Close more deals with a CRM you can shape to your process.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {LEGAL.appName} gives your team custom pipelines, a clear record of every change and a dashboard that shows what needs attention today.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" render={<Link href="/signup" />}>Get started</Button>
            <Button size="lg" variant="outline" render={<a href={`mailto:${LEGAL.contactEmail}?subject=${encodeURIComponent(`${LEGAL.appName} sales enquiry`)}`} />}>
              Talk to sales
            </Button>
          </div>
        </section>

        {/* Benefits */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">Everything your sales team needs, nothing it doesn&apos;t.</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
                  <Icon className="size-5 text-primary" />
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">Up and running in an afternoon</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{index + 1}</span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ. Native details/summary, so it works without JavaScript. */}
        <section className="mx-auto max-w-3xl px-4 pb-16">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">Frequently asked questions</h2>
          <div className="mt-8 divide-y rounded-2xl border">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Checklist + CTA */}
        <section className="mx-auto max-w-5xl px-4 pb-20">
          <div className="grid gap-10 rounded-3xl border bg-card p-6 md:grid-cols-2 md:p-12">
            <div className="flex flex-col gap-4">
              <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">Ready when your team is</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Start on your own, or talk to us about setting up {LEGAL.appName} for a bigger team.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" render={<Link href="/signup" />}>Get started</Button>
                <Button size="lg" variant="outline" render={<a href={`mailto:${LEGAL.contactEmail}?subject=${encodeURIComponent(`${LEGAL.appName} sales enquiry`)}`} />}>
                  Talk to sales
                </Button>
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {CHECKS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} {LEGAL.companyName}</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/compare-crm" className="hover:text-foreground">Compare</Link>
            {POLICIES.map((policy) => (
              <Link key={policy.href} href={policy.href} className="hover:text-foreground">{policy.label}</Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
