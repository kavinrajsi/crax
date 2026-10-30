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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { safeHref } from "@/lib/utils"
import { CompanyForm } from "@/components/company-form"
import { deleteCompany } from "@/app/(app)/companies/actions"
import { Trash2Icon, GlobeIcon } from "lucide-react"
import { sortRows } from "@/lib/table-utils"
import { SortableHead, useSort } from "@/components/sortable-head"
import { DesktopTable, EmptyState, FilterSearch, MobileList } from "@/components/page"
import { ListCard } from "@/components/list-card"

/** Website without scheme or trailing slash, for display. */
function displayWebsite(url) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

export function CompaniesTable({ companies: initialCompanies }) {
  const router = useRouter()
  const [companies, setCompanies] = useState(initialCompanies)
  const [search, setSearch] = useState("")
  const [error, setError] = useState(null)
  const { sort, toggleSort } = useSort({ column: "created_at", direction: "desc" })
  const [isPending, startTransition] = useTransition()

  const filtered = companies.filter((company) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      company.name?.toLowerCase().includes(q) ||
      company.industry?.toLowerCase().includes(q) ||
      company.website?.toLowerCase().includes(q)
    )
  })

  const rows = sortRows(filtered, sort.column, sort.direction)

  function handleDelete(event, companyId) {
    event.stopPropagation()
    // Snapshot before the optimistic removal — a failed delete used to leave the
    // company missing from the table while still present in the database.
    const previous = companies
    setCompanies((prev) => prev.filter((company) => company.id !== companyId))
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

  const emptyText = companies.length === 0
    ? "No companies yet — create one to get started."
    : "No companies match your search."

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Toolbar: search fills the row; the count and add button sit beside it. */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <FilterSearch value={search} onChange={setSearch} placeholder="Search companies…" />
        </div>
        <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">{rows.length}</Badge>
        <CompanyForm onSaved={handleCreated} />
      </div>

      {rows.length === 0 ? (
        <EmptyState>{emptyText}</EmptyState>
      ) : (
        <>
          <MobileList>
            {rows.map((company) => (
              <ListCard
                key={company.id}
                href={`/companies/${company.id}`}
                title={company.name}
                subtitle={company.industry || (company.website ? displayWebsite(company.website) : null)}
                badge={<Badge variant="secondary" className="text-xs tabular-nums">{company.contact_count ?? 0} contacts</Badge>}
                meta={[company.phone || null, company.website ? displayWebsite(company.website) : null]}
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(event) => handleDelete(event, company.id)}
                    disabled={isPending}
                  >
                    <Trash2Icon className="size-3.5" />
                    Delete
                  </Button>
                }
              />
            ))}
          </MobileList>

          <DesktopTable>
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
                {rows.map((company) => (
                  <TableRow
                    key={company.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/companies/${company.id}`)}
                  >
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{company.industry || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {safeHref(company.website) ? (
                        <a
                          href={safeHref(company.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <GlobeIcon className="h-3 w-3" />
                          {displayWebsite(company.website)}
                        </a>
                      ) : (company.website || "—")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{company.phone || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs tabular-nums">{company.contact_count ?? 0}</Badge>
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(event) => handleDelete(event, company.id)}
                        disabled={isPending}
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DesktopTable>
        </>
      )}
    </div>
  )
}
