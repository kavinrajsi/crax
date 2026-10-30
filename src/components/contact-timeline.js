"use client"

import { useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SendIcon, MessageSquareIcon } from "lucide-react"
import { addNote, updateNote } from "@/app/(app)/contacts/[id]/actions"
import { NoteItem } from "@/components/note-item"
import { RichTextEditor } from "@/components/rich-text-editor"

export function ContactTimeline({ contactId, initialNotes, currentUserEmail }) {
  const [notes, setNotes] = useState(initialNotes)
  const [draft, setDraft] = useState({ html: "", empty: true })
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()
  const editorRef = useRef(null)

  const items = [...notes].sort(
    (first, second) => new Date(first.created_at) - new Date(second.created_at)
  )

  function handleNoteSubmit(event) {
    event?.preventDefault()
    if (draft.empty || isPending) return
    const html = draft.html
    const tempId = `pending-${Date.now()}`
    const optimistic = {
      id: tempId,
      contact_id: contactId,
      author_email: "you",
      body: html,
      created_at: new Date().toISOString(),
      pending: true,
    }
    setNotes((prev) => [...prev, optimistic])
    editorRef.current?.commands.clearContent(true)
    setDraft({ html: "", empty: true })
    setError(null)
    /* Restore the draft on failure. Previously the promise was dropped, so a
       failed save cleared the editor and left the note rendered as if it had
       persisted — the user only found out on reload, with the text gone. */
    startTransition(async () => {
      try {
        const saved = await addNote(contactId, html)
        // Swap in the real row so the new note can be edited straight away.
        setNotes((prev) => prev.map((note) => (note.id === tempId ? saved : note)))
      } catch (err) {
        console.error("[contact-timeline] addNote failed", { contactId, err })
        setNotes((prev) => prev.filter((note) => note.id !== tempId))
        editorRef.current?.commands.setContent(html)
        setDraft({ html, empty: false })
        setError("Couldn't save that note. Your text has been restored.")
      }
    })
  }

  async function handleNoteSave(noteId, html) {
    const saved = await updateNote(noteId, html)
    setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, body: saved.body, updated_at: saved.updated_at } : note)))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Quick note input */}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <form onSubmit={handleNoteSubmit} className="flex flex-col gap-2">
        <RichTextEditor
          editorRef={editorRef}
          placeholder="Add a note… (⌘↵ to submit)"
          disabled={isPending}
          onChange={(html, empty) => setDraft({ html, empty })}
          onSubmit={handleNoteSubmit}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={draft.empty || isPending}
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
          {items.map((item, index) => (
            <div key={item.id}>
              {index > 0 && <Separator className="mb-4" />}
              <NoteItem
                note={item}
                icon={MessageSquareIcon}
                onSave={handleNoteSave}
                canEdit={!!currentUserEmail && item.author_email?.toLowerCase() === currentUserEmail.toLowerCase()}
              />
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
