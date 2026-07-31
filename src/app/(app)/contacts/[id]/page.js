import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon, TagIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { sql } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { CONTACT_FIELD_GROUPS } from "@/lib/contact-fields"
import { ContactFieldValue } from "@/components/contact-field-value"
import { ContactTimeline } from "@/components/contact-timeline"
import { ContactStatusSelect } from "@/components/contact-status-select"
import { ContactEditForm } from "@/components/contact-edit-form"
import { ContactTags } from "@/components/contact-tags"
import { ContactCompanySelect } from "@/components/contact-company-select"

export const dynamic = "force-dynamic"

function FieldCard({ field, contact, children }) {
  const Icon = field.icon
  return (
    <Card className={field.wide ? "col-span-full" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {field.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children ?? <ContactFieldValue field={field} contact={contact} />}
      </CardContent>
    </Card>
  )
}

export default async function ContactDetailPage({ params }) {
  await requireUser()

  const { id } = await params
  const [rows, notes, tags, activities, companies] = await Promise.all([
    sql`SELECT * FROM public.contact_us WHERE id = ${id} LIMIT 1`,
    sql`SELECT * FROM public.contact_notes WHERE contact_id = ${id} ORDER BY created_at ASC`,
    sql`SELECT * FROM public.contact_tags WHERE contact_id = ${id} ORDER BY created_at ASC`,
    sql`SELECT * FROM public.contact_activities WHERE contact_id = ${id} ORDER BY created_at ASC`,
    sql`SELECT id, name FROM public.companies ORDER BY name ASC`,
  ])
  const contact = rows[0]

  if (!contact) notFound()

  return (
    <div className="flex flex-col gap-6">
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
        <div className="flex items-center gap-2 shrink-0">
          <ContactStatusSelect contactId={contact.id} initialStatus={contact.status} />
        </div>
      </div>

      <Separator />

      {/* Every column on contact_us, grouped. Driven by CONTACT_FIELD_GROUPS so
          this page and the /data drawer cannot drift apart. */}
      {CONTACT_FIELD_GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{group.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.fields.map((field) => (
              <FieldCard key={field.key} field={field} contact={contact} />
            ))}

            {/* Editable controls live in their own cards alongside the group
                they belong to, rather than in the field list. */}
            {group.title === "Contact" && (
              <FieldCard
                field={{ key: "company_id", label: "Linked Company", icon: group.fields[3].icon }}
                contact={contact}
              >
                <ContactCompanySelect
                  contactId={contact.id}
                  initialCompanyId={contact.company_id}
                  companies={companies}
                  contactEmail={contact.email}
                />
              </FieldCard>
            )}
            {group.title === "Enquiry" && (
              <FieldCard field={{ key: "tags", label: "Tags", icon: TagIcon }} contact={contact}>
                <ContactTags contactId={contact.id} initialTags={tags} />
              </FieldCard>
            )}
          </div>
        </section>
      ))}

      <Separator />

      {/* Timeline keeps a measure: prose needs one even when the page does not. */}
      <div className="max-w-3xl">
        <ContactTimeline
          contactId={contact.id}
          initialNotes={notes}
          initialActivities={activities}
        />
      </div>
    </div>
  )
}
