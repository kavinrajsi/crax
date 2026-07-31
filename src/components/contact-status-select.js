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

/** The status swatch. Same size and shape in the trigger and the menu. */
function StatusDot({ color }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  )
}

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
    <div className="flex flex-col items-start gap-1">
      <Select value={status} onValueChange={handleChange}>
        {/* h-8, not h-7: the base recipe's data-[size=default]:h-8 is an
            attribute selector and outranks a plain h-7, so h-7 never applied.
            Stating the real height stops it reading as a 28px control. */}
        <SelectTrigger
          className="h-8 w-36 text-xs font-medium"
          style={{
            backgroundColor: `${color}18`,
            color,
            borderColor: `${color}40`,
          }}
        >
          {/* SelectValue with no children falls back to stringifying the raw
              value, so the trigger read "follow-up" while the menu read
              "Follow-up", and carried no colour dot. Render the same dot and
              label the items do. */}
          <SelectValue>
            <span className="flex items-center gap-2">
              <StatusDot color={color} />
              {current?.label ?? status}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <StatusDot color={opt.color} />
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
