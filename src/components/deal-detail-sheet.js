"use client"

import { useState, useTransition, useRef } from "react"
import Link from "next/link"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PencilIcon,
  CheckIcon,
  XIcon,
  Trash2Icon,
  SendIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { updateDeal, deleteDeal, addDealNote } from "@/app/(app)/deals/actions"

const STAGES = ["Qualification", "Proposal", "Negotiation", "Closed-Won", "Closed-Lost"]

const STAGE_COLORS = {
  Qualification: "#6366f1",
  Proposal:      "#f59e0b",
  Negotiation:   "#3b82f6",
  "Closed-Won":  "#22c55e",
  "Closed-Lost": "#ef4444",
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function initials(email) {
  return (email || "?").split("@")[0].slice(0, 2).toUpperCase()
}

function formatValue(v) {
  if (v == null) return "—"
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v)
}

export function DealDetailSheet({ deal, contacts, notes: initialNotes, open, onOpenChange, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState({
    title:       deal?.title ?? "",
    value:       deal?.value ?? "",
    stage:       deal?.stage ?? "Qualification",
    probability: deal?.probability ?? 50,
    close_date:  deal?.close_date ?? "",
    contact_id:  deal?.contact_id ? String(deal.contact_id) : "",
  })
  const [notes, setNotes] = useState(initialNotes ?? [])
  const [noteBody, setNoteBody] = useState("")
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef(null)

  // Sync fields when deal changes
  const dealId = deal?.id
  if (deal && deal.id !== dealId) {
    setFields({
      title:       deal.title ?? "",
      value:       deal.value ?? "",
      stage:       deal.stage ?? "Qualification",
      probability: deal.probability ?? 50,
      close_date:  deal.close_date ?? "",
      contact_id:  deal.contact_id ? String(deal.contact_id) : "",
    })
    setNotes(initialNotes ?? [])
    setEditing(false)
  }

  function handleSave() {
    startTransition(async () => {
      const payload = {
        title:       fields.title,
        value:       fields.value !== "" ? parseFloat(fields.value) : null,
        stage:       fields.stage,
        probability: parseInt(fields.probability) || 50,
        close_date:  fields.close_date || null,
        contact_id:  fields.contact_id ? parseInt(fields.contact_id) : null,
      }
      await updateDeal(deal.id, payload)
      onUpdated?.({ ...deal, ...payload })
      setEditing(false)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteDeal(deal.id)
      onDeleted?.(deal.id)
      onOpenChange(false)
    })
  }

  function handleNoteSubmit(e) {
    e.preventDefault()
    const trimmed = noteBody.trim()
    if (!trimmed) return
    const optimistic = { id: Date.now(), deal_id: deal.id, author_email: "you", body: trimmed, created_at: new Date().toISOString() }
    setNotes((prev) => [...prev, optimistic])
    setNoteBody("")
    startTransition(() => addDealNote(deal.id, trimmed))
  }

  function handleNoteKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleNoteSubmit(e)
  }

  if (!deal) return null

  const stageColor = STAGE_COLORS[deal.stage] ?? "#64748b"
  const linkedContact = contacts.find((c) => c.id === deal.contact_id)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <div className="flex items-start justify-between gap-3 pr-8">
            {editing ? (
              <Input
                value={fields.title}
                onChange={(e) => setFields((p) => ({ ...p, title: e.target.value }))}
                className="text-base font-semibold h-9"
                disabled={isPending}
              />
            ) : (
              <SheetTitle className="text-base leading-snug">{deal.title}</SheetTitle>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border"
              style={{ backgroundColor: `${stageColor}18`, color: stageColor, borderColor: `${stageColor}40` }}
            >
              {deal.stage}
            </span>
            {deal.won_at && <Badge variant="secondary" className="text-[10px]">Won</Badge>}
            {deal.lost_at && <Badge variant="destructive" className="text-[10px]">Lost</Badge>}
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-5 py-4 flex-1">
          {/* Edit / action bar */}
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-1.5 text-xs">
                  <CheckIcon className="h-3.5 w-3.5" />
                  {isPending ? "Saving…" : "Save"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={isPending} className="gap-1.5 text-xs">
                  <XIcon className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5 text-xs">
                <PencilIcon className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="ml-auto gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            {/* Value */}
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Value</span>
              {editing ? (
                <Input type="number" min="0" step="0.01" value={fields.value} onChange={(e) => setFields((p) => ({ ...p, value: e.target.value }))} className="h-7 text-xs" disabled={isPending} />
              ) : (
                <span className="font-medium">{formatValue(deal.value)}</span>
              )}
            </div>

            {/* Probability */}
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Probability</span>
              {editing ? (
                <Input type="number" min="0" max="100" value={fields.probability} onChange={(e) => setFields((p) => ({ ...p, probability: e.target.value }))} className="h-7 text-xs" disabled={isPending} />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${deal.probability ?? 0}%` }} />
                  </div>
                  <span className="font-medium shrink-0">{deal.probability ?? 0}%</span>
                </div>
              )}
            </div>

            {/* Stage */}
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Stage</span>
              {editing ? (
                <Select value={fields.stage} onValueChange={(v) => setFields((p) => ({ ...p, stage: v }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-medium">{deal.stage}</span>
              )}
            </div>

            {/* Close date */}
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Close date</span>
              {editing ? (
                <Input type="date" value={fields.close_date} onChange={(e) => setFields((p) => ({ ...p, close_date: e.target.value }))} className="h-7 text-xs" disabled={isPending} />
              ) : (
                <span className="font-medium">{deal.close_date ?? "—"}</span>
              )}
            </div>

            {/* Contact */}
            <div className="flex flex-col gap-1 col-span-2">
              <span className="text-muted-foreground">Linked contact</span>
              {editing ? (
                <Select value={fields.contact_id} onValueChange={(v) => setFields((p) => ({ ...p, contact_id: v }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name || c.email || `#${c.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : linkedContact ? (
                <Link
                  href={`/contacts/${linkedContact.id}`}
                  className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  {linkedContact.name || linkedContact.email}
                  <ExternalLinkIcon className="h-3 w-3" />
                </Link>
              ) : (
                <span className="font-medium text-muted-foreground">—</span>
              )}
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold">Notes</h3>
            {notes.length > 0 && (
              <div className="flex flex-col gap-3">
                {notes.map((note) => (
                  <div key={note.id} className="flex items-start gap-2">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className="text-[9px]">{initials(note.author_email)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-medium">{note.author_email}</span>
                        <span className="text-[11px] text-muted-foreground">{timeAgo(note.created_at)}</span>
                      </div>
                      <p className="text-xs whitespace-pre-wrap break-words">{note.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleNoteSubmit} className="flex flex-col gap-2">
              <Textarea
                ref={textareaRef}
                placeholder="Add a note… (⌘↵ to submit)"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                onKeyDown={handleNoteKeyDown}
                rows={3}
                className="resize-none text-xs"
                disabled={isPending}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!noteBody.trim() || isPending} className="gap-1.5 text-xs">
                  <SendIcon className="h-3 w-3" />
                  {isPending ? "Saving…" : "Add Note"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
