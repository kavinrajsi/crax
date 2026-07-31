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
} from "lucide-react"
import { sortRows } from "@/lib/table-utils"
import { SortableHead, useSort } from "@/components/sortable-head"




export function CompaniesTable({ companies: initialCompanies }) {
  const router = useRouter()
  const [companies, setCompanies] = useState(initialCompanies)
  const [search, setSearch] = useState("")
  const [error, setError] = useState(null)
  const { sort, toggleSort } = useSort({ column: "created_at", direction: "desc" })
  const [isPending, startTransition] = useTransition()


  const filtered = companies.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.industry?.toLowerCase().includes(q) ||
      c.website?.toLowerCase().includes(q)
    )
  })

  const rows = sortRows(filtered, sort.column, sort.direction)

  function handleDelete(e, companyId) {
    e.stopPropagation()
    // Snapshot before the optimistic removal — a failed delete used to leave the
    // company missing from the table while still present in the database.
    const previous = companies
    setCompanies((prev) => prev.filter((c) => c.id !== companyId))
    setError(null)
    startTransition(async () => {
      try {
        await deleteCompany(companyId)
      } catch (err) {
        console.error("[companies-table] deleteCompany failed", { companyId, err })
        setCompanies(previous)
        setError("Couldn't delete that company. It has been restored.")
      }
    })
  }

  function handleCreated(company) {
    setCompanies((prev) => [{ ...company, contact_count: 0 }, ...prev])
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
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
              <SortableHead label="Company"  column="name"          sort={sort} onSort={toggleSort} />
              <SortableHead label="Industry" column="industry"      sort={sort} onSort={toggleSort} />
              <SortableHead label="Website"  column="website"       sort={sort} onSort={toggleSort} />
              <SortableHead label="Phone"    column="phone"         sort={sort} onSort={toggleSort} />
              <SortableHead label="Contacts" column="contact_count" sort={sort} onSort={toggleSort} className="w-24 text-center" />
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
