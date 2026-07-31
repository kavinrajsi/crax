"use client"

import { useState, useTransition } from "react"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { addActivity } from "@/app/(app)/contacts/[id]/actions"

const TYPES = [
  { value: "call",    label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "email",   label: "Email" },
  { value: "task",    label: "Task" },
]

export function AddActivityDialog({ contactId, onAdded }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState("task")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return

    const payload = {
      type,
      title: title.trim(),
      body: body.trim() || null,
      due_at: dueAt || null,
    }

    setError(null)
    startTransition(async () => {
      try {
        await addActivity(contactId, payload)
        onAdded?.({ ...payload, id: Date.now(), contact_id: contactId, created_at: new Date().toISOString(), completed_at: null })
        setType("task")
        setTitle("")
        setBody("")
        setDueAt("")
        setOpen(false)
      } catch (err) {
        // onAdded is only called on success now — it used to run regardless,
        // adding a timeline entry for an activity that was never stored.
        console.error("[add-activity] addActivity failed", { contactId, err })
        setError("Couldn't save that activity.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" />
        }
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add Activity
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Activity</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Follow up on proposal"
              disabled={isPending}
              required
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Optional details…"
              rows={3}
              className="resize-none text-sm"
              disabled={isPending}
            />
          </div>

          {/* Due date */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Due date</Label>
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="text-xs"
              disabled={isPending}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={!title.trim() || isPending}>
              {isPending ? "Saving…" : "Add Activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
