import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeftIcon,
  BuildingIcon,
  GlobeIcon,
  PhoneIcon,
  UsersIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { sql } from "@/lib/db"
import { CompanyForm } from "@/components/company-form"
import { CompanyNotesSection } from "@/components/company-notes-section"

import { requireUser } from "@/lib/dal"
import { safeHref } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function CompanyDetailPage({ params }) {
  await requireUser()

  const { id } = await params

  const [rows, contacts, notes] = await Promise.all([
    sql`SELECT * FROM public.companies WHERE id = ${id} LIMIT 1`,
    // The same view /companies counts through, so this list and the
    // contact_count beside it cannot disagree.
    sql`SELECT id, name, email, status FROM public.contact_us
        WHERE company_id = ${id}
        ORDER BY created_at DESC`,
    sql`SELECT * FROM public.company_notes WHERE company_id = ${id} ORDER BY created_at ASC`,
  ])

  const company = rows[0]
  if (!company) notFound()

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <Link
        href="/companies"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Companies
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <BuildingIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <h1 className="font-heading text-2xl font-semibold tracking-tight truncate">
              {company.name}
            </h1>
          </div>
          {company.industry && (
            <p className="text-sm text-muted-foreground mt-1">{company.industry}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CompanyForm company={company} />
        </div>
      </div>

      <Separator />

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <GlobeIcon className="h-3.5 w-3.5" />
              Website
            </CardTitle>
          </CardHeader>
          <CardContent>
            {safeHref(company.website) ? (
              <a href={safeHref(company.website)} target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all">
                {company.website.replace(/^https?:\/\//, "")}
              </a>
            ) : <p className="text-sm text-muted-foreground">{company.website || "—"}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <PhoneIcon className="h-3.5 w-3.5" />
              Phone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{company.phone || "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Contacts */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground">Contacts</h2>
          <Badge variant="secondary" className="text-xs">{contacts.length}</Badge>
        </div>

        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 text-center py-4">
            No contacts linked to this company yet. Link contacts from their detail page.
          </p>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {contacts.map((c) => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{c.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{c.email || "—"}</p>
                </div>
                <Badge variant="outline" className="text-xs">{c.status || "—"}</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Notes */}
      <CompanyNotesSection companyId={company.id} initialNotes={notes} />
    </div>
  )
}
