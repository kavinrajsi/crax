"use client"

import { useState, useTransition, useRef } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { SendIcon, MessageSquareIcon } from "lucide-react"
import { addNote } from "@/app/(app)/contacts/[id]/actions"
import { timeAgo } from "@/lib/table-utils"


function initials(email) {
  return (email || "?").split("@")[0].slice(0, 2).toUpperCase()
}

export function ContactTimeline({ contactId, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes)
  const [noteBody, setNoteBody] = useState("")
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef(null)

  const items = [...notes].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )

  function handleNoteSubmit(e) {
    e.preventDefault()
    const trimmed = noteBody.trim()
    if (!trimmed) return
    const optimistic = {
      id: Date.now(),
      contact_id: contactId,
      author_email: "you",
      body: trimmed,
      created_at: new Date().toISOString(),
    }
    setNotes((prev) => [...prev, optimistic])
    setNoteBody("")
    setError(null)
    /* Restore the draft on failure. Previously the promise was dropped, so a
       failed save cleared the textarea and left the note rendered as if it had
       persisted — the user only found out on reload, with the text gone. */
    startTransition(async () => {
      try {
        await addNote(contactId, trimmed)
      } catch (err) {
        console.error("[contact-timeline] addNote failed", { contactId, err })
        setNotes((prev) => prev.filter((n) => n.id !== optimistic.id))
        setNoteBody(trimmed)
        setError("Couldn't save that note. Your text has been restored.")
      }
    })
  }

  function handleNoteKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleNoteSubmit(e)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Quick note input */}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <form onSubmit={handleNoteSubmit} className="flex flex-col gap-2">
        <Textarea
          ref={textareaRef}
          placeholder="Add a note… (⌘↵ to submit)"
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          onKeyDown={handleNoteKeyDown}
          rows={3}
          className="resize-none text-sm"
          disabled={isPending}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!noteBody.trim() || isPending}
            className="gap-1.5"
          >
            <SendIcon className="h-3.5 w-3.5" />
            {isPending ? "Saving…" : "Add Note"}
          </Button>
        </div>
      </form>

      <Separator />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Timeline</h2>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="flex flex-col gap-4">
          {items.map((item, i) => (
            <div key={item.id}>
              {i > 0 && <Separator className="mb-4" />}
              <div className="flex items-start gap-3">
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarFallback className="text-[10px]">{initials(item.author_email)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquareIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium">{item.author_email}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{timeAgo(item.created_at)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{item.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center py-4">
          No notes yet — add one above.
        </p>
      )}
    </div>
  )
}
