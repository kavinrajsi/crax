"use client"

import { Fragment, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core"
import { useKanbanSensors } from "@/hooks/use-kanban-sensors"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ChevronLeftIcon, ChevronRightIcon, GripVerticalIcon, MailIcon, PhoneIcon, BuildingIcon, GlobeIcon } from "lucide-react"
import { updateContactStatus, moveContactToPipeline } from "@/app/(app)/pipeline/actions"
import { sourceDomain, timeAgo } from "@/lib/table-utils"

/* ─── helpers ─────────────────────────────────────────────────────────── */

function CardRow({ icon: Icon, value }) {
  const blank = !value
  return (
    <div className={`flex items-center gap-1 ${blank ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{blank ? "—" : value}</span>
    </div>
  )
}

/* ─── Contact Card ────────────────────────────────────────────────────── */

function ContactCard({ contact, pipelines = [], onMove }) {
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
          className="mt-0.5 shrink-0 text-muted-foreground/30 hover:text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity touch-none"
          onClick={(event) => event.stopPropagation()}
        >
          <GripVerticalIcon className="h-3.5 w-3.5" />
        </span>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Name + date */}
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-sm leading-snug break-words">{contact.name || "—"}</span>
            <span className="text-muted-foreground whitespace-nowrap shrink-0">{timeAgo(contact.created_at)}</span>
          </div>

          {/* Always four rows, blank as "—", so every card has the same shape
              and a missing value reads as missing rather than as a shorter card. */}
          <CardRow icon={MailIcon}     value={contact.email} />
          <CardRow icon={BuildingIcon} value={contact.company} />
          {/* truncate matters: without overflow:hidden a flex item cannot shrink
              below its content, and the column body's overflow-y-auto promotes
              overflow-x to auto — so one long value would give this single
              column its own horizontal scrollbar. */}
          <CardRow icon={PhoneIcon}    value={contact.phone} />
          <CardRow icon={GlobeIcon}    value={contact.source_url ? sourceDomain(contact.source_url, "") : ""} />

          {/* Needs */}
          {Array.isArray(contact.needs) && contact.needs.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {contact.needs.map((need) => (
                <Badge key={need} variant="secondary" className="text-[10px] px-1.5 py-0">{need}</Badge>
              ))}
            </div>
          )}

          {/* Move to another pipeline. Stops the click and the drag from reaching the card. */}
          {pipelines.length > 1 && onMove && (
            <div onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
              <select
                aria-label="Move to pipeline"
                value=""
                onChange={(event) => {
                  if (event.target.value) onMove(contact, Number(event.target.value))
                }}
                className="h-7 w-full rounded-md border border-border bg-transparent px-1.5 text-[11px] text-muted-foreground"
              >
                <option value="">Move to pipeline…</option>
                {pipelines
                  .filter((pipeline) => pipeline.id !== contact.pipeline_id)
                  .map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
              </select>
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

/**
 * `filter` narrows what is *shown*, not what is *held*: the full list stays in
 * state so the caller can switch filters without remounting and losing an
 * optimistic move that is still in flight.
 */
export function ContactsKanban({ contacts: initialContacts, statusColumns, pipelines = [], filter }) {
  const [contacts, setContacts] = useState(initialContacts)
  const [activeContact, setActiveContact] = useState(null)
  const [error, setError] = useState(null)
  const [, startTransition] = useTransition()

  const sensors = useKanbanSensors()

  /* The card leaves this board at once (its pipeline no longer matches the
     filter); the server then sets its first stage in the target pipeline. */
  function moveToPipeline(contact, pipelineId) {
    const previous = { pipeline_id: contact.pipeline_id, status: contact.status }
    setError(null)
    setContacts((prev) => prev.map((entry) => entry.id === contact.id ? { ...entry, pipeline_id: pipelineId } : entry))
    startTransition(async () => {
      try {
        const { status } = await moveContactToPipeline(contact.id, pipelineId)
        setContacts((prev) => prev.map((entry) => entry.id === contact.id ? { ...entry, status } : entry))
      } catch (err) {
        console.error("[contacts-kanban] pipeline move failed", err)
        setContacts((prev) => prev.map((entry) => entry.id === contact.id ? { ...entry, ...previous } : entry))
        setError(`Couldn't move ${contact.name || "contact"}.`)
      }
    })
  }

  /* Desktop only: a collapsed column shrinks to a narrow strip so the other
     stages get the width. Phone always shows every column in full. */
  const [collapsed, setCollapsed] = useState(() => new Set())

  function toggleCollapsed(key) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function contactsForStatus(status) {
    return contacts.filter((contact) => contact.status === status && (!filter || filter(contact)))
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
      const target = contacts.find((entry) => entry.id === targetId)
      if (target) newStatus = target.status
    }

    if (newStatus === contact.status) return

    /* Optimistic update, with a rollback. The transition used to discard the
       returned promise entirely, so a rejected action left the card sitting in
       its new column forever — the UI claimed a status the database never got. */
    const previousStatus = contact.status
    setContacts((prev) =>
      prev.map((entry) => entry.id === contact.id ? { ...entry, status: newStatus } : entry)
    )
    setError(null)

    startTransition(async () => {
      try {
        await updateContactStatus(contact.id, newStatus)
      } catch (err) {
        console.error("[contacts-kanban] status update failed", err)
        setContacts((prev) =>
          prev.map((entry) => entry.id === contact.id ? { ...entry, status: previousStatus } : entry)
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
      {/* Phone: one column at a time, swiped left to right with snap. md+: a horizontal board. */}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:snap-none md:px-0 md:pb-4">
        {statusColumns.map((col) => {
          const colContacts = contactsForStatus(col.key)
          const itemIds = colContacts.map((colContact) => `contact-${colContact.id}`)

          const isCollapsed = collapsed.has(col.key)

          return (
            <Fragment key={col.key}>
            {/* Collapsed strip (desktop only): label runs vertically, click to expand. */}
            <button
              type="button"
              onClick={() => toggleCollapsed(col.key)}
              aria-label={`Expand ${col.label}`}
              title={`Expand ${col.label}`}
              className={`${isCollapsed ? "md:flex" : "md:hidden"} hidden w-12 shrink-0 flex-col items-center gap-3 rounded-xl border border-border bg-muted/40 py-3 hover:bg-muted/60`}
            >
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: col.color }}
              />
              <span className="text-sm font-medium [writing-mode:vertical-rl] rotate-180">{col.label}</span>
              <Badge variant="secondary" className="text-xs tabular-nums">{colContacts.length}</Badge>
            </button>

            <div
              id={`col-${col.key}`}
              className={`flex w-[85%] shrink-0 snap-center flex-col rounded-xl border border-border bg-muted/40 md:w-72 ${isCollapsed ? "md:hidden" : ""}`}
            >
              {/* Column header */}
              {/* The whole header collapses the column on desktop. Phone keeps every column open. */}
              <div
                role="button"
                tabIndex={0}
                aria-label={`Collapse ${col.label}`}
                title={`Collapse ${col.label}`}
                onClick={() => toggleCollapsed(col.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    toggleCollapsed(col.key)
                  }
                }}
                className="flex items-center gap-2 px-3 py-2.5 md:cursor-pointer md:rounded-t-xl md:hover:bg-muted/60 md:focus-visible:outline-none md:focus-visible:ring-2 md:focus-visible:ring-ring"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: col.color }}
                />
                <span className="flex-1 text-sm font-medium">{col.label}</span>
                <Badge variant="secondary" className="text-xs tabular-nums">{colContacts.length}</Badge>
                <ChevronLeftIcon aria-hidden="true" className="hidden md:block h-4 w-4 text-muted-foreground" />
              </div>

              <Separator />

              {/* Cards */}
              <div
                id={`col-${col.key}`}
                className="flex max-h-[calc(100vh-300px)] flex-col gap-2 overflow-y-auto p-2 min-h-[80px] md:max-h-[calc(100vh-260px)]"
              >
                <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                  {colContacts.length === 0 ? (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/50 border border-dashed border-border rounded-lg">
                      Drop here
                    </div>
                  ) : (
                    colContacts.map((contact) => (
                      <ContactCard key={contact.id} contact={contact} pipelines={pipelines} onMove={moveToPipeline} />
                    ))
                  )}
                </SortableContext>
              </div>
            </div>
            </Fragment>
          )
        })}
      </div>

      <DragOverlay>
        {activeContact && <OverlayCard contact={activeContact} />}
      </DragOverlay>
    </DndContext>
  )
}
