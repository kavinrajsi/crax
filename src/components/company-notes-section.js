"use client"

import { useState, useTransition, useRef } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { SendIcon } from "lucide-react"
import { addCompanyNote } from "@/app/(app)/companies/actions"
import { timeAgo } from "@/lib/table-utils"


function initials(email) {
  return (email || "?").split("@")[0].slice(0, 2).toUpperCase()
}

export function CompanyNotesSection({ companyId, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes)
  const [body, setBody] = useState("")
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef(null)

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    const optimistic = { id: Date.now(), company_id: companyId, author_email: "you", body: trimmed, created_at: new Date().toISOString() }
    setNotes((prev) => [...prev, optimistic])
    setBody("")
    startTransition(() => addCompanyNote(companyId, trimmed))
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Notes</h2>
        {notes.length > 0 && (
          <span className="text-xs text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {notes.length > 0 && (
        <div className="flex flex-col gap-3">
          {notes.map((note, i) => (
            <div key={note.id}>
              {i > 0 && <Separator className="mb-3" />}
              <div className="flex items-start gap-3">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px]">{initials(note.author_email)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{note.author_email}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(note.created_at)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{note.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center py-2">No notes yet.</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Textarea
          ref={textareaRef}
          placeholder="Add a note… (⌘↵ to submit)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          className="resize-none text-sm"
          disabled={isPending}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!body.trim() || isPending} className="gap-1.5">
            <SendIcon className="h-3.5 w-3.5" />
            {isPending ? "Saving…" : "Add Note"}
          </Button>
        </div>
      </form>
    </div>
  )
}
