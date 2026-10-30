import Link from "next/link"
import { LEGAL } from "@/lib/legal"

/** Shared frame for every policy page. Public, so no session is needed. */
export function LegalDocument({ title, children }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/login" className="font-semibold">{LEGAL.appName}</Link>
          <Link href="/policies" className="text-sm text-muted-foreground hover:text-foreground">All policies</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-heading text-[32px] font-bold leading-tight tracking-tight md:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {LEGAL.updated}</p>
        <div className="mt-8 flex flex-col gap-8 text-[15px] leading-relaxed">
          {children}
        </div>
        <p className="mt-12 text-xs text-muted-foreground">
          {LEGAL.companyName}, {LEGAL.address}. Contact: {LEGAL.contactEmail}.
        </p>
      </main>
    </div>
  )
}

export function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}
