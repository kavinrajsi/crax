"use client"

import { Badge } from "@/components/ui/badge"
import { JsonViewer } from "@/components/json-viewer"
import { formatDate, sourceDomain } from "@/lib/table-utils"
import { isBlank } from "@/lib/contact-fields"

/**
 * Renders one contact field according to its `kind`. Shared by the detail page
 * and the /data drawer so a field looks the same wherever it appears.
 *
 * Takes primitives only — never the field descriptor object. That object
 * carries `icon`, a component function, and the detail page renders this from
 * a Server Component: passing it whole threw "Functions cannot be passed
 * directly to Client Components" on every render of /contacts/[id]. The icon
 * belongs to the card header, which is server-rendered, so it has no business
 * crossing the boundary at all.
 */
export function ContactFieldValue({ value, kind, breakAll = false }) {
  if (isBlank(value)) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  switch (kind) {
    case "url":
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline break-all"
          title={value}
        >
          {sourceDomain(value)}
        </a>
      )

    case "date":
      return <span className="text-sm">{formatDate(value)}</span>

    case "array":
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <Badge key={item} variant="secondary" className="text-xs">{item}</Badge>
          ))}
        </div>
      )

    case "json":
      return <JsonViewer data={value} />

    case "longtext":
      // The enquiry body. Capped measure so it stays readable on a full-width
      // page, and whitespace preserved because these arrive as typed.
      return <p className="text-sm whitespace-pre-wrap break-words max-w-prose">{value}</p>

    default:
      return <span className={`text-sm ${breakAll ? "break-all" : ""}`}>{value}</span>
  }
}
