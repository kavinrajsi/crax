"use client"

import { useState, useTransition } from "react"
import { PencilIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { NoteBody } from "@/components/note-body"
import { RichTextEditor } from "@/components/rich-text-editor"
import { isRichNote, plainTextToHtml } from "@/lib/note-format"
import { timeAgo } from "@/lib/table-utils"

function initials(email) {
  return (email || "?").split("@")[0].slice(0, 2).toUpperCase()
}

/**
 * One note with an inline edit mode. Shared by the contact timeline and the
 * company notes section so both surfaces edit and render identically.
 *
 * @param {object}   props
 * @param {object}   props.note        row from contact_notes / company_notes
 * @param {Function} props.onSave      (noteId, html) → Promise; rejects on failure
 * @param {object}   [props.icon]      lucide icon shown before the author
 * @param {boolean}  [props.canEdit=true] whether the viewer may open the edit control
 */
export function NoteItem({ note, onSave, icon: Icon, canEdit = true }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ html: "", empty: true })
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()

  function startEdit() {
    const html = isRichNote(note.body) ? note.body : plainTextToHtml(note.body)
    setDraft({ html, empty: false })
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setError(null)
  }

  function save() {
    if (draft.empty || isPending) return
    const html = draft.html
    startTransition(async () => {
      try {
        await onSave(note.id, html)
        setEditing(false)
      } catch (err) {
        console.error("[note-item] save failed", { noteId: note.id, err })
        setError("Couldn't save your changes.")
      }
    })
  }

  return (
    <div className="group/note flex items-start gap-3">
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback className="text-[10px]">{initials(note.author_email)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
          <span className="text-xs font-medium">{note.author_email}</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {note.pending ? "Saving…" : timeAgo(note.created_at)}
            {!note.pending && note.updated_at && (
              <span title={`Edited ${timeAgo(note.updated_at)}`}> · edited</span>
            )}
          </span>
          {canEdit && !editing && !note.pending && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Edit note"
              title="Edit note"
              className="text-muted-foreground opacity-0 transition-opacity group-hover/note:opacity-100 focus-visible:opacity-100"
              onClick={startEdit}
            >
              <PencilIcon />
            </Button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <RichTextEditor
              content={draft.html}
              autoFocus
              disabled={isPending}
              onChange={(html, empty) => setDraft({ html, empty })}
              onSubmit={save}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={isPending}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={draft.empty || isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <NoteBody body={note.body} className={note.pending ? "opacity-60" : ""} />
        )}
      </div>
    </div>
  )
}
