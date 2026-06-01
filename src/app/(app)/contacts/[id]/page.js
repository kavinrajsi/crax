import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeftIcon,
  MailIcon,
  PhoneIcon,
  BuildingIcon,
  GlobeIcon,
  CalendarIcon,
  TagIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { sql } from "@/lib/db"
import { ContactNotes } from "@/components/contact-notes"
import { ContactStatusSelect } from "@/components/contact-status-select"
import { ContactEditForm } from "@/components/contact-edit-form"
import { ContactTags } from "@/components/contact-tags"

export const dynamic = "force-dynamic"

function formatDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function sourceDomain(url) {
  try { return new URL(url).hostname.replace("www.", "") }
  catch { return url || "—" }
}

export default async function ContactDetailPage({ params }) {
  const { id } = await params
  const [rows, notes, tags] = await Promise.all([
    sql`SELECT * FROM public.contact_us WHERE id = ${id} LIMIT 1`,
    sql`SELECT * FROM public.contact_notes WHERE contact_id = ${id} ORDER BY created_at ASC`,
    sql`SELECT * FROM public.contact_tags WHERE contact_id = ${id} ORDER BY created_at ASC`,
  ])
  const contact = rows[0]

  if (!contact) notFound()

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Back link */}
      <Link
        href="/data"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Data
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight truncate">
              {contact.name || "—"}
            </h1>
            <ContactEditForm contact={contact} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Contact #{contact.id}</p>
        </div>
        <ContactStatusSelect contactId={contact.id} initialStatus={contact.status} />
      </div>

      {/* Edit form (rendered inline below header when open) */}

      <Separator />

      {/* Detail cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Email */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <MailIcon className="h-3.5 w-3.5" />
              Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm break-all">{contact.email || "—"}</p>
          </CardContent>
        </Card>

        {/* Phone */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <PhoneIcon className="h-3.5 w-3.5" />
              Phone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{contact.phone || "—"}</p>
          </CardContent>
        </Card>

        {/* Company */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <BuildingIcon className="h-3.5 w-3.5" />
              Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{contact.company || "—"}</p>
          </CardContent>
        </Card>

        {/* Source */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <GlobeIcon className="h-3.5 w-3.5" />
              Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contact.source_url ? (
              <a
                href={contact.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all"
              >
                {sourceDomain(contact.source_url)}
              </a>
            ) : (
              <p className="text-sm">—</p>
            )}
          </CardContent>
        </Card>

        {/* Needs */}
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <TagIcon className="h-3.5 w-3.5" />
              Needs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Array.isArray(contact.needs) && contact.needs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {contact.needs.map((n) => (
                  <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <TagIcon className="h-3.5 w-3.5" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ContactTags contactId={contact.id} initialTags={tags} />
          </CardContent>
        </Card>

        {/* Created at */}
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              Submitted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{formatDate(contact.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Notes trail */}
      <ContactNotes contactId={contact.id} initialNotes={notes} />
    </div>
  )
}
