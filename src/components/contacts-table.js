"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SearchIcon } from "lucide-react"
import { sortRows, formatDate } from "@/lib/table-utils"
import { SortableHead, useSort } from "@/components/sortable-head"
import { statusMeta } from "@/lib/contact-statuses"

export function ContactsTable({ contacts }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const { sort, toggleSort } = useSort({ column: "created_at", direction: "desc" })

  const filtered = contacts.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q)
    )
  })

  const rows = sortRows(filtered, sort.column, sort.direction)

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{rows.length}</Badge>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Name"    column="name"       sort={sort} onSort={toggleSort} />
              <SortableHead label="Email"   column="email"      sort={sort} onSort={toggleSort} />
              <SortableHead label="Phone"   column="phone"      sort={sort} onSort={toggleSort} />
              <SortableHead label="Company" column="company"    sort={sort} onSort={toggleSort} />
              <SortableHead label="Status"  column="status"     sort={sort} onSort={toggleSort} />
              <SortableHead label="Added"   column="created_at" sort={sort} onSort={toggleSort} className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  {search ? "No contacts match that search." : "No contacts yet."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => {
                const meta = statusMeta(c.status)
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/contacts/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.email || "—"}</TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">{c.phone || "—"}</TableCell>
                    <TableCell className="text-xs">{c.company_name || c.company || "—"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right tabular-nums">
                      {formatDate(c.created_at)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
