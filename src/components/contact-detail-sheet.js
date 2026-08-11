"use client"

import { useEffect, useState } from "react"
import { BuildingIcon, TagIcon, ExternalLinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ContactTimeline } from "@/components/contact-timeline"
import { ContactStatusSelect } from "@/components/contact-status-select"
import { ContactEditForm } from "@/components/contact-edit-form"
import { ContactTags } from "@/components/contact-tags"
import { ContactCompanySelect } from "@/components/contact-company-select"
import { CONTACT_FIELD_GROUPS } from "@/lib/contact-fields"
import { ContactFieldValue } from "@/components/contact-field-value"



function Field({ icon: Icon, label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground font-medium inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export function ContactDetailSheet({ contact, companies, open, onOpenChange, finalFocusRef }) {
  /* The parent drops `contact` to null the instant the drawer closes; rendering off
     that directly blanks the body while the panel is still sliding out. Keep showing
     the last contact through the exit animation. Compared by id, not identity —
     /data is force-dynamic, so every RSC refresh hands down a new row object. */
  const [displayedContact, setDisplayedContact] = useState(contact)
  if (contact && contact.id !== displayedContact?.id) setDisplayedContact(contact)

  const contactId = contact?.id ?? null
  const [loadedDetail, setLoadedDetail] = useState(null)

  // Notes/tags aren't in the /data payload — fetch per contact on open.
  useEffect(() => {
    if (contactId == null) return
    const abortController = new AbortController()
    fetch(`/api/contacts/${contactId}`, { signal: abortController.signal })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error(response.status))
      )
      .then((data) => setLoadedDetail({ contactId, loadFailed: false, ...data }))
      .catch((error) => {
        // An empty timeline and a failed load look identical otherwise, and a
        // user who reads a 401 as "no notes yet" will add a duplicate note.
        if (error.name !== "AbortError") {
          setLoadedDetail({ contactId, loadFailed: true, notes: [], tags: [] })
        }
      })
    // Abort so a fast open→close→open can't land stale data in another contact's drawer.
    return () => abortController.abort()
  }, [contactId])

  // Tagging the payload with its contact id beats clearing state in the effect —
  // a leftover payload from the previously opened row reads as "still loading".
  // Matched against the displayed contact so the body doesn't flash back to
  // skeletons on close.
  const contactDetail =
    displayedContact && loadedDetail?.contactId === displayedContact.id ? loadedDetail : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        /* twMerge keeps the base data-[side=right]:sm:max-w-sm rather than collapsing
           it, but this one wins on source order — computed max-width is 672px. */
        className="data-[side=right]:sm:max-w-2xl w-full gap-0 p-0"
        finalFocus={finalFocusRef}
      >
        {displayedContact && (
          <>
            <SheetHeader className="flex-row items-start justify-between gap-3 border-b pr-12">
              <div className="min-w-0">
                <SheetTitle className="truncate">{displayedContact.name || "—"}</SheetTitle>
                <SheetDescription>Contact #{displayedContact.id}</SheetDescription>
              </div>
              <div className="shrink-0">
                <ContactStatusSelect
                  key={`status-${displayedContact.id}`}
                  contactId={displayedContact.id}
                  initialStatus={displayedContact.status}
                />
              </div>
            </SheetHeader>

            {/* SheetContent is already flex flex-col h-full, so this is the whole scroll story. */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4">
              {/* Keys are prefixed: these are siblings, so a bare displayedContact.id
                  would collide with the timeline's key below. */}
              <ContactEditForm key={`edit-${displayedContact.id}`} contact={displayedContact} />

              {/* Same CONTACT_FIELD_GROUPS as /contacts/[id], so the drawer can
                  never show fewer columns than the full page again. Layout stays
                  per-surface: two columns here, up to four on the page. */}
              {CONTACT_FIELD_GROUPS.map((group) => (
                <div key={group.title} className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">{group.title}</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {group.fields.map((field) => (
                      <div
                        key={field.key}
                        className={field.wide ? "sm:col-span-2" : undefined}
                      >
                        <Field icon={field.icon} label={field.label}>
                          <ContactFieldValue
                            value={displayedContact[field.key]}
                            kind={field.kind}
                            breakAll={field.breakAll}
                          />
                        </Field>
                      </div>
                    ))}

                    {group.title === "Contact" && (
                      <div className="sm:col-span-2">
                        <Field icon={BuildingIcon} label="Linked Company">
                          <ContactCompanySelect
                            key={`company-${displayedContact.id}`}
                            contactId={displayedContact.id}
                            initialCompanyId={displayedContact.company_id}
                            companies={companies}
                            contactEmail={displayedContact.email}
                          />
                        </Field>
                      </div>
                    )}

                    {group.title === "Enquiry" && (
                      <div className="sm:col-span-2">
                        <Field icon={TagIcon} label="Tags">
                          {contactDetail?.loadFailed ? (
                            <p className="text-xs text-muted-foreground">Couldn&apos;t load tags.</p>
                          ) : contactDetail ? (
                            <ContactTags
                              key={`tags-${displayedContact.id}`}
                              contactId={displayedContact.id}
                              initialTags={contactDetail.tags}
                            />
                          ) : (
                            <Skeleton className="h-7 w-56" />
                          )}
                        </Field>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <Separator />

              {contactDetail?.loadFailed ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Couldn&apos;t load notes for this contact.
                </p>
              ) : contactDetail ? (
                <ContactTimeline
                  key={`timeline-${displayedContact.id}`}
                  contactId={displayedContact.id}
                  initialNotes={contactDetail.notes}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              )}
            </div>

            <SheetFooter className="mt-0 border-t">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs w-fit"
                nativeButton={false}
                render={<a href={`/contacts/${displayedContact.id}`} />}
              >
                Open full page
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
