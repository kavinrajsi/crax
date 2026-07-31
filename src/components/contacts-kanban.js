"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { GripVerticalIcon, MailIcon, PhoneIcon, BuildingIcon, GlobeIcon } from "lucide-react"
import { updateContactStatus } from "@/app/(app)/planner/actions"
import { sourceDomain, timeAgo } from "@/lib/table-utils"

/* ─── helpers ─────────────────────────────────────────────────────────── */



/* ─── Contact Card ────────────────────────────────────────────────────── */

function ContactCard({ contact }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `contact-${contact.id}`,
    data: { type: "contact", contact },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-lg border border-border bg-card p-3 shadow-sm text-xs cursor-pointer hover:border-primary/40 transition-colors"
      onClick={() => router.push(`/contacts/${contact.id}`)}
    >
      <div className="flex items-start gap-2">
        <span
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVerticalIcon className="h-3.5 w-3.5" />
        </span>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Name + date */}
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-sm leading-snug break-words">{contact.name || "—"}</span>
            <span className="text-muted-foreground whitespace-nowrap shrink-0">{timeAgo(contact.created_at)}</span>
          </div>

          {/* Email */}
          {contact.email && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MailIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}

          {/* Phone */}
          {contact.phone && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <PhoneIcon className="h-3 w-3 shrink-0" />
              {/* truncate like the other fields: without overflow:hidden a flex
                  item cannot shrink below its content, and the column body's
                  overflow-y-auto promotes overflow-x to auto — so one long value
                  would give this single column its own horizontal scrollbar. */}
              <span className="truncate">{contact.phone}</span>
            </div>
          )}

          {/* Company */}
          {contact.company && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <BuildingIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{contact.company}</span>
            </div>
          )}

          {/* Source */}
          {contact.source_url && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <GlobeIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{sourceDomain(contact.source_url, "")}</span>
            </div>
          )}

          {/* Needs */}
          {Array.isArray(contact.needs) && contact.needs.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {contact.needs.map((n) => (
                <Badge key={n} variant="secondary" className="text-[10px] px-1.5 py-0">{n}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Overlay card ────────────────────────────────────────────────────── */

function OverlayCard({ contact }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs w-64 opacity-90">
      <p className="font-semibold text-sm">{contact.name || "—"}</p>
      {contact.email && <p className="text-muted-foreground mt-0.5">{contact.email}</p>}
    </div>
  )
}

/* ─── ContactsKanban ──────────────────────────────────────────────────── */

export function ContactsKanban({ contacts: initialContacts, statusColumns }) {
  const [contacts, setContacts] = useState(initialContacts)
  const [activeContact, setActiveContact] = useState(null)
  const [error, setError] = useState(null)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function contactsForStatus(status) {
    return contacts.filter((c) => c.status === status)
  }

  function onDragStart(event) {
    const data = event.active.data.current
    if (data?.type === "contact") setActiveContact(data.contact)
  }

  function onDragEnd(event) {
    const { active, over } = event
    setActiveContact(null)
    if (!over) return

    const contact = active.data.current?.contact
    if (!contact) return

    // Determine target status from the over element
    const overId = over.id.toString()
    let newStatus = contact.status

    if (overId.startsWith("col-")) {
      newStatus = overId.replace("col-", "")
    } else if (overId.startsWith("contact-")) {
      const targetId = parseInt(overId.replace("contact-", ""))
      const target = contacts.find((c) => c.id === targetId)
      if (target) newStatus = target.status
    }

    if (newStatus === contact.status) return

    /* Optimistic update, with a rollback. The transition used to discard the
       returned promise entirely, so a rejected action left the card sitting in
       its new column forever — the UI claimed a status the database never got. */
    const previousStatus = contact.status
    setContacts((prev) =>
      prev.map((c) => c.id === contact.id ? { ...c, status: newStatus } : c)
    )
    setError(null)

    startTransition(async () => {
      try {
        await updateContactStatus(contact.id, newStatus)
      } catch (err) {
        console.error("[contacts-kanban] status update failed", err)
        setContacts((prev) =>
          prev.map((c) => c.id === contact.id ? { ...c, status: previousStatus } : c)
        )
        setError(`Couldn't move ${contact.name || "contact"} to ${newStatus}.`)
      }
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {error && (
        <p className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {statusColumns.map((col) => {
          const colContacts = contactsForStatus(col.key)
          const itemIds = colContacts.map((c) => `contact-${c.id}`)

          return (
            <div
              key={col.key}
              id={`col-${col.key}`}
              /* flex-1 so all seven columns share the width instead of a fixed
                 w-72 that forced 2088px and scrolled sideways below ~2400px.
                 min-w keeps them legible on narrow screens — below ~1150px the
                 parent's overflow-x-auto takes over rather than crushing them. */
              className="flex flex-1 min-w-[9rem] flex-col rounded-xl border border-border bg-muted/40"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: col.color }}
                />
                <span className="flex-1 text-sm font-medium">{col.label}</span>
                <Badge variant="secondary" className="text-xs tabular-nums">{colContacts.length}</Badge>
              </div>

              <Separator />

              {/* Cards */}
              <div
                id={`col-${col.key}`}
                className="flex flex-col gap-2 overflow-y-auto p-2 min-h-[80px]"
                style={{ maxHeight: "calc(100vh - 260px)" }}
              >
                <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                  {colContacts.length === 0 ? (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/50 border border-dashed border-border rounded-lg">
                      Drop here
                    </div>
                  ) : (
                    colContacts.map((contact) => (
                      <ContactCard key={contact.id} contact={contact} />
                    ))
                  )}
                </SortableContext>
              </div>
            </div>
          )
        })}
      </div>

      <DragOverlay>
        {activeContact && <OverlayCard contact={activeContact} />}
      </DragOverlay>
    </DndContext>
  )
}
