"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { BuildingIcon, ExternalLinkIcon, ZapIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { linkContactToCompany } from "@/app/(app)/companies/actions"
import { detectAndLinkCompany } from "@/app/(app)/contacts/[id]/actions"

export function ContactCompanySelect({ contactId, initialCompanyId, companies, contactEmail }) {
  const [companyId, setCompanyId] = useState(initialCompanyId ? String(initialCompanyId) : "")
  const [allCompanies, setAllCompanies] = useState(companies)
  const [detectMsg, setDetectMsg] = useState(null)
  const [isPending, startTransition] = useTransition()

  function handleChange(val) {
    // Revert on failure: the select used to keep showing a link that was never
    // written, because the transition discarded the promise.
    const previous = companyId
    setCompanyId(val)
    setDetectMsg(null)
    startTransition(async () => {
      try {
        await linkContactToCompany(contactId, val ? parseInt(val) : null)
      } catch (error) {
        console.error("[contact-company] link failed", { contactId, val, error })
        setCompanyId(previous)
        setDetectMsg("Couldn't change the linked company.")
      }
    })
  }

  function handleDetect() {
    setDetectMsg(null)
    startTransition(async () => {
      try {
        const result = await detectAndLinkCompany(contactId)
        if (!result) {
          setDetectMsg("No business domain found in email.")
          return
        }
        setCompanyId(String(result.companyId))
        // If it's a newly created company, add it to the local list so the Select shows it
        if (result.created || !allCompanies.find((c) => c.id === result.companyId)) {
          setAllCompanies((prev) => [
            ...prev.filter((c) => c.id !== result.companyId),
            { id: result.companyId, name: result.companyName },
          ])
        }
        setDetectMsg(
          result.created
            ? `Created and linked "${result.companyName}"`
            : `Linked to "${result.companyName}"`
        )
      } catch (error) {
        console.error("[contact-company] detect failed", { contactId, error })
        setDetectMsg("Couldn't detect a company from that email.")
      }
    })
  }

  const linked = allCompanies.find((c) => String(c.id) === companyId)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={companyId} onValueChange={handleChange} disabled={isPending}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Link to a company…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {allCompanies.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                <BuildingIcon className="h-3 w-3 shrink-0" />
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {contactEmail && (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleDetect}
            disabled={isPending}
            title="Auto-detect company from email domain"
            className="shrink-0"
          >
            <ZapIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {detectMsg && (
        <p className="text-xs text-muted-foreground">{detectMsg}</p>
      )}

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
