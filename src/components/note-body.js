import { isRichNote } from "@/lib/note-format"

/**
 * Renders a stored note. Rich rows are HTML that was sanitised on the server
 * before it was written (see src/lib/note-html.js); legacy rows are plain text.
 */
export function NoteBody({ body, className = "" }) {
  if (isRichNote(body)) {
    return (
      <div
        className={`note-content text-sm break-words ${className}`}
        dangerouslySetInnerHTML={{ __html: body }}
      />
    )
  }
  return <p className={`text-sm whitespace-pre-wrap break-words ${className}`}>{body}</p>
}
