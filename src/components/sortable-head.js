"use client"

import { useState } from "react"
import { ChevronsUpDownIcon, ChevronUpIcon, ChevronDownIcon } from "lucide-react"
import { TableHead } from "@/components/ui/table"

/**
 * The React half of the shared table helpers — see `src/lib/table-utils.js`
 * for the pure ones. Split because server components import those directly and
 * a "use client" module's exports would reach them as client references.
 */

/** Three-state sort: asc → desc → off. */
export function useSort(initial = { column: null, direction: "asc" }) {
  const [sort, setSort] = useState(initial)
  function toggleSort(column) {
    setSort((prevSort) =>
      prevSort.column === column
        ? prevSort.direction === "asc"
          ? { column, direction: "desc" }
          : { column: null, direction: "asc" }
        : { column, direction: "asc" }
    )
  }
  return { sort, setSort, toggleSort }
}

/**
 * Sticky positioning and background differ per table — pass them through
 * `className` rather than forking the component again.
 */
export function SortableHead({ label, column, sort, onSort, className = "" }) {
  const isActive = sort.column === column
  const Icon = isActive
    ? sort.direction === "asc" ? ChevronUpIcon : ChevronDownIcon
    : ChevronsUpDownIcon
  return (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={`h-3 w-3 ${isActive ? "text-foreground" : "text-muted-foreground/40"}`} />
      </span>
    </TableHead>
  )
}
