import Link from "next/link"
import { LEGAL } from "@/lib/legal"
import { COMPARE_CHECKED, CRAX_FEATURES, COMPETITORS } from "@/lib/compare-crm"

export const metadata = { title: "Compare CRMs · Crax" }

export default function CompareCrmPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/login" className="font-semibold">{LEGAL.appName}</Link>
          <Link href="/policies" className="text-sm text-muted-foreground hover:text-foreground">Policies</Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
        <section className="flex flex-col gap-3">
          <h1 className="font-heading text-[32px] font-bold leading-tight tracking-tight md:text-4xl">Compare {LEGAL.appName} with other CRMs</h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Pick the tool that fits how your team sells. This page covers what each one is best at, when to choose it, and where it is weaker.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{LEGAL.appName} at a glance</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {CRAX_FEATURES.map((feature) => (
              <li key={feature} className="rounded-xl border p-3 text-sm">{feature}</li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Side by side</h2>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Tool</th>
                  <th className="py-2 pr-4 font-medium">Best for</th>
                  <th className="py-2 pr-4 font-medium">Choose it if</th>
                  <th className="py-2 font-medium">Watch out for</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b bg-muted/40 align-top">
                  <td className="py-3 pr-4 font-semibold">{LEGAL.appName}</td>
                  <td className="py-3 pr-4">Small and mid-size teams that want custom pipelines, a clear audit trail and a phone-friendly app.</td>
                  <td className="py-3 pr-4">You want to shape stages to your process and keep a history of who changed what.</td>
                  <td className="py-3">Fewer built-in integrations than the large suites. No native mobile app yet.</td>
                </tr>
                {COMPETITORS.map((tool) => (
                  <tr key={tool.name} className="border-b align-top">
                    <td className="py-3 pr-4 font-medium">{tool.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{tool.bestFor}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{tool.choose}</td>
                    <td className="py-3 text-muted-foreground">{tool.limits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Competitor details are general positioning, last reviewed {COMPARE_CHECKED}. Check each vendor&apos;s site for current pricing and features before you decide.
        </p>
      </main>
    </div>
  )
}
