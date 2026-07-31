"use client"

import { useState, useTransition } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateContactStatus } from "@/app/(app)/planner/actions"

const STATUS_OPTIONS = [
  { value: "New",       label: "New",       color: "#3b82f6" },
  { value: "follow-up", label: "Follow-up", color: "#f97316" },
  { value: "win",       label: "Win",       color: "#22c55e" },
  { value: "closed",    label: "Closed",    color: "#64748b" },
  { value: "rejected",  label: "Rejected",  color: "#ef4444" },
  { value: "fake",      label: "Fake",      color: "#a855f7" },
  { value: "test",      label: "Test",      color: "#14b8a6" },
]

export function ContactStatusSelect({ contactId, initialStatus }) {
  const [status, setStatus] = useState(initialStatus ?? "New")
  const [failed, setFailed] = useState(false)
  const [, startTransition] = useTransition()

  function handleChange(newStatus) {
    // Optimistic, with a revert — the transition previously dropped the promise,
    // so a failed write left the badge showing a status the database never had.
    const previousStatus = status
    setStatus(newStatus)
    setFailed(false)
    startTransition(async () => {
      try {
        await updateContactStatus(contactId, newStatus)
      } catch (error) {
        console.error("[contact-status] update failed", { contactId, newStatus, error })
        setStatus(previousStatus)
        setFailed(true)
      }
    })
  }

  const current = STATUS_OPTIONS.find((s) => s.value === status)
  const color = current?.color ?? "#64748b"

  return (
    <div className="flex flex-col items-end gap-1">
    <Select value={status} onValueChange={handleChange}>
      <SelectTrigger
        className="h-7 text-xs font-medium border w-36"
        style={{
          backgroundColor: `${color}18`,
          color,
          borderColor: `${color}40`,
        }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: opt.color }}
            />
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {failed && (
      <span className="text-[10px] text-destructive">Couldn&apos;t save — reverted.</span>
    )}
    </div>
  )
}
