"use client"

import { useState, useTransition, useRef } from "react"
import { addNote } from "@/app/(app)/contacts/[id]/actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { SendIcon } from "lucide-react"

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

export function ContactNotes({ contactId, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes)
  const [body, setBody] = useState("")
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef(null)

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return

    // Optimistic update
    const optimistic = {
      id: Date.now(),
      contact_id: contactId,
      author_email: "you",
      body: trimmed,
      created_at: new Date().toISOString(),
    }
    setNotes((prev) => [...prev, optimistic])
    setBody("")

    startTransition(async () => {
      await addNote(contactId, trimmed)
    })
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Notes</h2>
        {notes.length > 0 && (
          <span className="text-xs text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Notes trail */}
      {notes.length > 0 && (
        <div className="flex flex-col gap-3">
          {notes.map((note, i) => (
            <div key={note.id}>
              {i > 0 && <Separator className="mb-3" />}
              <div className="flex items-start gap-3">
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
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

      {/* Input */}
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
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || isPending}
            className="gap-1.5"
          >
            <SendIcon className="h-3.5 w-3.5" />
            {isPending ? "Saving…" : "Add Note"}
          </Button>
        </div>
      </form>
    </div>
  )
}
