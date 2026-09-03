"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContactsKanban } from "@/components/contacts-kanban"
import {
  PIPELINE_SOURCES,
  DEFAULT_PIPELINE_SOURCE,
  contactMatchesSource,
} from "@/lib/contact-sources"

/**
 * Pipeline page body: one board, four source tabs (All / Zoho / Madarth /
 * Search). Filtering is client-side over the full contact list so switching
 * tabs never remounts the kanban — an in-flight optimistic status move on one
 * tab survives a switch to another.
 *
 * The chosen tab is mirrored into ?source= via history.replaceState (which
 * Next syncs with useSearchParams) so a tab is linkable without a navigation
 * that would re-run the page's SQL and flash the loading skeleton.
 */
export function PipelineBoard({ contacts, statusColumns, initialSource }) {
  const [source, setSource] = useState(initialSource)

  const counts = Object.fromEntries(
    PIPELINE_SOURCES.map((s) => [s.key, contacts.filter((c) => contactMatchesSource(c, s.key)).length])
  )
  const visible = counts[source] ?? 0

  function onSourceChange(next) {
    setSource(next)
    const url = new URL(window.location.href)
    if (next === DEFAULT_PIPELINE_SOURCE) url.searchParams.delete("source")
    else url.searchParams.set("source", next)
    window.history.replaceState(null, "", url)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track {visible} lead{visible === 1 ? "" : "s"} across the pipeline.
        </p>
      </div>

      <Tabs value={source} onValueChange={onSourceChange}>
        <TabsList>
          {PIPELINE_SOURCES.map((s) => (
            <TabsTrigger key={s.key} value={s.key}>
              {s.label}
              <span className="text-xs tabular-nums text-muted-foreground">{counts[s.key]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ContactsKanban
        contacts={contacts}
        statusColumns={statusColumns}
        filter={(c) => contactMatchesSource(c, source)}
      />
    </div>
  )
}
