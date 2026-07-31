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
import { sql, EXCLUDED_EMAILS } from "@/lib/db"
import { CompanyForm } from "@/components/company-form"
import { CompanyNotesSection } from "@/components/company-notes-section"

import { requireUser } from "@/lib/dal"

export const dynamic = "force-dynamic"

export default async function CompanyDetailPage({ params }) {
  await requireUser()

  const { id } = await params

  const [rows, contacts, notes] = await Promise.all([
    sql`SELECT * FROM public.companies WHERE id = ${id} LIMIT 1`,
    // Filtered so this list agrees with the contact_count on /companies.
    sql`SELECT id, name, email, status FROM public.contact_us
        WHERE company_id = ${id} AND email != ALL(${EXCLUDED_EMAILS})
        ORDER BY created_at DESC`,
    sql`SELECT * FROM public.company_notes WHERE company_id = ${id} ORDER BY created_at ASC`,
  ])

  const company = rows[0]
  if (!company) notFound()

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
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
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border">
              <BuildingIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{company.name}</h1>
          </div>
          {company.industry && (
            <p className="text-sm text-muted-foreground mt-1 ml-11">{company.industry}</p>
          )}
        </div>
        <CompanyForm company={company} />
      </div>

      <Separator />

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <GlobeIcon className="h-3.5 w-3.5" />
              Website
            </CardTitle>
          </CardHeader>
          <CardContent>
            {company.website ? (
              <a href={company.website} target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all">
                {company.website.replace(/^https?:\/\//, "")}
              </a>
            ) : <p className="text-sm text-muted-foreground">—</p>}
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
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Contacts</h2>
          <Badge variant="secondary" className="text-xs">{contacts.length}</Badge>
        </div>

        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 py-3">
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
      </div>

      <Separator />

      {/* Notes */}
      <CompanyNotesSection companyId={company.id} initialNotes={notes} />
    </div>
  )
}
