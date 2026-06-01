"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { BuildingIcon, ExternalLinkIcon } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { linkContactToCompany } from "@/app/(app)/companies/actions"

export function ContactCompanySelect({ contactId, initialCompanyId, companies }) {
  const [companyId, setCompanyId] = useState(initialCompanyId ? String(initialCompanyId) : "")
  const [, startTransition] = useTransition()

  function handleChange(val) {
    setCompanyId(val)
    startTransition(() => linkContactToCompany(contactId, val ? parseInt(val) : null))
  }

  const linked = companies.find((c) => String(c.id) === companyId)

  return (
    <div className="flex flex-col gap-2">
      <Select value={companyId} onValueChange={handleChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Link to a company…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">None</SelectItem>
          {companies.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              <BuildingIcon className="h-3 w-3 shrink-0" />
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {linked && (
        <Link
          href={`/companies/${linked.id}`}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          View {linked.name}
          <ExternalLinkIcon className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}
