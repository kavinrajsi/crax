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
import { useStages, useStatusMeta } from "@/components/stage-context"
import { CountChips, DesktopTable, EmptyState, FilterSearch, MobileList } from "@/components/page"
import { ListCard } from "@/components/list-card"
import { Badge } from "@/components/ui/badge"

function StatusBadge({ status }) {
  const statusMeta = useStatusMeta()
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

  const filtered = contacts.filter((contact) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      contact.name?.toLowerCase().includes(q) ||
      contact.email?.toLowerCase().includes(q) ||
      contact.phone?.toLowerCase().includes(q) ||
      contact.company?.toLowerCase().includes(q) ||
      contact.company_name?.toLowerCase().includes(q)
    )
  })

  const rows = sortRows(filtered, sort.column, sort.direction)

  const stages = useStages()
  const statusMeta = useStatusMeta()

  const chips = stages.map((stage) => ({
    label: stage.label,
    color: stage.color,
    count: contacts.filter((contact) => contact.status === stage.key).length,
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
            {rows.map((row) => (
              <ListCard
                key={row.id}
                href={`/contacts/${row.id}`}
                title={row.name || row.email || "—"}
                subtitle={row.email || row.company_name || row.company}
                badge={<StatusBadge status={row.status} />}
                meta={[row.phone, row.company_name || row.company, formatDate(row.created_at, { compact: true })]}
              />
            ))}
          </MobileList>

          <DesktopTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Name"    column="name"       sort={sort} onSort={toggleSort} />
                  <SortableHead label="Phone"   column="phone"      sort={sort} onSort={toggleSort} />
                  <SortableHead label="Company" column="company"    sort={sort} onSort={toggleSort} />
                  <SortableHead label="Status"  column="status"     sort={sort} onSort={toggleSort} />
                  <SortableHead label="Added"   column="created_at" sort={sort} onSort={toggleSort} className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const meta = statusMeta(row.status)
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/contacts/${row.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div>{row.name || "—"}</div>
                        {row.email && <div className="text-xs font-normal text-muted-foreground">{row.email}</div>}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">{row.phone || "—"}</TableCell>
                      <TableCell className="text-xs">{row.company_name || row.company || "—"}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                        {formatDate(row.created_at)}
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
