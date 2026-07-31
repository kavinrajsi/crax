"use client"

import { useState } from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"

/**
 * Collapsed one-line preview, click to expand formatted JSON.
 *
 * Lifted out of logs-view.js (where it was a local JsonCell) so the contact
 * detail page and drawer can render raw_payload the same way. The width caps
 * that only made sense inside a narrow table cell are now passed in by the
 * caller via className rather than baked in.
 */
export function JsonViewer({ data, className = "" }) {
  const [open, setOpen] = useState(false)

  if (data == null || (typeof data === "object" && Object.keys(data).length === 0)) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const preview = JSON.stringify(data)
  const short = preview.length > 60 ? preview.slice(0, 60) + "…" : preview

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors max-w-full"
      >
        {open
          ? <ChevronDownIcon className="h-3 w-3 shrink-0" />
          : <ChevronRightIcon className="h-3 w-3 shrink-0" />}
        <span className="font-mono truncate">{short}</span>
      </button>
      {open && (
        <pre className="mt-1 rounded bg-muted p-2 text-[11px] font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
