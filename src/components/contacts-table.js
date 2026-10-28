"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { sortRows, formatDate } from "@/lib/table-utils"
import { SortableHead, useSort } from "@/components/sortable-head"
import { statusMeta } from "@/lib/contact-statuses"
import { CountChips, DesktopTable, EmptyState, FilterSearch, MobileList } from "@/components/page"
import { ListCard } from "@/components/list-card"
import { Badge } from "@/components/ui/badge"
import { CONTACT_STATUSES } from "@/lib/contact-statuses"

function StatusBadge({ status }) {
  const meta = statusMeta(status)
  return (
    <Badge
      variant="outline"
      className="shrink-0 text-[10px] px-1.5 py-0"
      style={{ backgroundColor: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}40` }}
    >
      {meta.label}
    </Badge>
  )
}

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

  const chips = CONTACT_STATUSES.map((s) => ({
    label: s.label,
    color: s.color,
    count: contacts.filter((c) => c.status === s.key).length,
  })).filter((chip) => chip.count > 0)

  return (
    <div className="flex flex-col gap-4">
      <CountChips items={chips} />

      <FilterSearch value={search} onChange={setSearch} placeholder="Search name, email, phone or company…" />

      {rows.length === 0 ? (
        <EmptyState>{search ? "No contacts match that search." : "No contacts yet."}</EmptyState>
      ) : (
        <>
          <MobileList>
            {rows.map((c) => (
              <ListCard
                key={c.id}
                href={`/contacts/${c.id}`}
                title={c.name || c.email || "—"}
                subtitle={c.email || c.company_name || c.company}
                badge={<StatusBadge status={c.status} />}
                meta={[c.phone, c.company_name || c.company, formatDate(c.created_at, { compact: true })]}
              />
            ))}
          </MobileList>

          <DesktopTable>
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
                {rows.map((c) => {
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
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                        {formatDate(c.created_at)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </DesktopTable>
        </>
      )}
    </div>
  )
}
