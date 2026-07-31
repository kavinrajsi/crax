import { Skeleton } from "@/components/ui/skeleton"
import { CONTACT_FIELD_GROUPS } from "@/lib/contact-fields"
import { BackLink, FieldCardSkeleton, ThreadSkeleton } from "@/components/skeletons"

/**
 * Mirrors src/app/(app)/contacts/[id]/page.js.
 *
 * Reads the same CONTACT_FIELD_GROUPS the page does, so the card count and the
 * col-span-full placement can't drift when a column is added. The page also
 * injects one extra card per group for its editable controls (Linked Company
 * under "Contact", Tags under "Enquiry") — mirrored below.
 */
const EXTRA_CARD_GROUPS = ["Contact", "Enquiry"]

export default function ContactDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <BackLink width="w-28" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-56" />
            {/* edit pencil, size="icon-sm" */}
            <Skeleton className="size-7 rounded-lg" />
          </div>
          <Skeleton className="mt-0.5 h-5 w-28" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* status select */}
          <Skeleton className="h-7 w-36 rounded-lg" />
        </div>
      </div>

      <div className="h-px w-full shrink-0 bg-border" />

      {CONTACT_FIELD_GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-24" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.fields.map((field) => (
              <FieldCardSkeleton
                key={field.key}
                wide={field.wide}
                valueLines={field.wide ? 3 : 1}
              />
            ))}
            {EXTRA_CARD_GROUPS.includes(group.title) && <FieldCardSkeleton />}
          </div>
        </section>
      ))}

      <div className="h-px w-full shrink-0 bg-border" />

      <div className="max-w-3xl">
        <ThreadSkeleton titleWidth="w-20" entries={3} showMetaIcon />
      </div>
    </div>
  )
}
