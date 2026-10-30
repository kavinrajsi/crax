"use client"

import { useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SendIcon } from "lucide-react"
import { addCompanyNote, updateCompanyNote } from "@/app/(app)/companies/actions"
import { NoteItem } from "@/components/note-item"
import { RichTextEditor } from "@/components/rich-text-editor"

export function CompanyNotesSection({ companyId, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes)
  const [draft, setDraft] = useState({ html: "", empty: true })
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()
  const editorRef = useRef(null)

  function handleSubmit(event) {
    event?.preventDefault()
    if (draft.empty || isPending) return
    const html = draft.html
    const tempId = `pending-${Date.now()}`
    const optimistic = {
      id: tempId,
      company_id: companyId,
      author_email: "you",
      body: html,
      created_at: new Date().toISOString(),
      pending: true,
    }
    setNotes((prev) => [...prev, optimistic])
    editorRef.current?.commands.clearContent(true)
    setDraft({ html: "", empty: true })
    setError(null)
    startTransition(async () => {
      try {
        const saved = await addCompanyNote(companyId, html)
        setNotes((prev) => prev.map((note) => (note.id === tempId ? saved : note)))
      } catch (err) {
        console.error("[company-notes] addCompanyNote failed", { companyId, err })
        setNotes((prev) => prev.filter((note) => note.id !== tempId))
        editorRef.current?.commands.setContent(html)
        setDraft({ html, empty: false })
        setError("Couldn't save that note. Your text has been restored.")
      }
    })
  }

  async function handleNoteSave(noteId, html) {
    const saved = await updateCompanyNote(noteId, html)
    setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, body: saved.body, updated_at: saved.updated_at } : note)))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Notes</h2>
        {notes.length > 0 && (
          <span className="text-xs text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {notes.length > 0 && (
        <div className="flex flex-col gap-3">
          {notes.map((note, index) => (
            <div key={note.id}>
              {index > 0 && <Separator className="mb-3" />}
              <NoteItem note={note} onSave={handleNoteSave} />
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center py-2">No notes yet.</p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <RichTextEditor
          editorRef={editorRef}
          placeholder="Add a note… (⌘↵ to submit)"
          disabled={isPending}
          onChange={(html, empty) => setDraft({ html, empty })}
          onSubmit={handleSubmit}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={draft.empty || isPending} className="gap-1.5">
            <SendIcon className="h-3.5 w-3.5" />
            {isPending ? "Saving…" : "Add Note"}
          </Button>
        </div>
      </form>
    </div>
  )
}
