"use client"

import { useState, useTransition } from "react"
import { PlusIcon, PencilIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { createCompany, updateCompany } from "@/app/(app)/companies/actions"

export function CompanyForm({ company, onSaved, trigger }) {
  const editing = !!company
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(company?.name ?? "")
  const [industry, setIndustry] = useState(company?.industry ?? "")
  const [website, setWebsite] = useState(company?.website ?? "")
  const [phone, setPhone] = useState(company?.phone ?? "")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    const fields = {
      name: name.trim(),
      industry: industry.trim() || null,
      website: website.trim() || null,
      phone: phone.trim() || null,
    }
    startTransition(async () => {
      if (editing) {
        await updateCompany(company.id, fields)
        onSaved?.({ ...company, ...fields })
      } else {
        const created = await createCompany(fields)
        onSaved?.(created)
        setName(""); setIndustry(""); setWebsite(""); setPhone("")
      }
      setOpen(false)
    })
  }

  const defaultTrigger = editing ? (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
      <PencilIcon className="h-3.5 w-3.5" />
      Edit
    </Button>
  ) : (
    <Button size="sm" className="gap-1.5 text-xs">
      <PlusIcon className="h-3.5 w-3.5" />
      New Company
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span />} asChild>
        <span onClick={() => setOpen(true)} className="contents">
          {trigger ?? defaultTrigger}
        </span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Company" : "New Company"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Company name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp" disabled={isPending} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Industry</Label>
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. SaaS, Retail, Healthcare" disabled={isPending} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" type="url" disabled={isPending} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" disabled={isPending} />
          </div>

          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={!name.trim() || isPending}>
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
