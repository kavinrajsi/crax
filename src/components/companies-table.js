"use client"

import { useState, useTransition } from "react"
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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CompanyForm } from "@/components/company-form"
import { deleteCompany } from "@/app/(app)/companies/actions"
import {
  SearchIcon,
  Trash2Icon,
  GlobeIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "lucide-react"

function getValue(row, key) {
  const v = row[key]
  if (v == null) return ""
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v).getTime()
  return typeof v === "string" ? v.toLowerCase() : v
}

function sortRows(rows, col, dir) {
  if (!col) return rows
  return [...rows].sort((a, b) => {
    const av = getValue(a, col)
    const bv = getValue(b, col)
    if (av < bv) return dir === "asc" ? -1 : 1
    if (av > bv) return dir === "asc" ? 1 : -1
    return 0
  })
}

function SortableHead({ label, col, sort, onSort, className = "" }) {
  const active = sort.col === col
  const Icon = active ? (sort.dir === "asc" ? ChevronUpIcon : ChevronDownIcon) : ChevronsUpDownIcon
  return (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/40"}`} />
      </span>
    </TableHead>
  )
}

export function CompaniesTable({ companies: initialCompanies }) {
  const router = useRouter()
  const [companies, setCompanies] = useState(initialCompanies)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState({ col: "created_at", dir: "desc" })
  const [isPending, startTransition] = useTransition()

  function toggleSort(col) {
    setSort((prev) =>
      prev.col === col
        ? prev.dir === "asc" ? { col, dir: "desc" } : { col: null, dir: "asc" }
        : { col, dir: "asc" }
    )
  }

  const filtered = companies.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.industry?.toLowerCase().includes(q) ||
      c.website?.toLowerCase().includes(q)
    )
  })

  const rows = sortRows(filtered, sort.col, sort.dir)

  function handleDelete(e, companyId) {
    e.stopPropagation()
    setCompanies((prev) => prev.filter((c) => c.id !== companyId))
    startTransition(() => deleteCompany(companyId))
  }

  function handleCreated(company) {
    setCompanies((prev) => [{ ...company, contact_count: 0 }, ...prev])
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{rows.length}</Badge>
          <CompanyForm onSaved={handleCreated} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Company"  col="name"          sort={sort} onSort={toggleSort} />
              <SortableHead label="Industry" col="industry"      sort={sort} onSort={toggleSort} />
              <SortableHead label="Website"  col="website"       sort={sort} onSort={toggleSort} />
              <SortableHead label="Phone"    col="phone"         sort={sort} onSort={toggleSort} />
              <SortableHead label="Contacts" col="contact_count" sort={sort} onSort={toggleSort} className="w-24 text-center" />
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-sm">
                  {companies.length === 0 ? "No companies yet — create one to get started." : "No companies match your search."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((company) => (
                <TableRow
                  key={company.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/companies/${company.id}`)}
                >
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{company.industry || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <GlobeIcon className="h-3 w-3" />
                        {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{company.phone || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs tabular-nums">{company.contact_count ?? 0}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDelete(e, company.id)}
                      disabled={isPending}
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
