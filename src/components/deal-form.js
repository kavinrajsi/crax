"use client"

import { useState, useTransition } from "react"
import { PlusIcon, PencilIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DEAL_STAGES } from "@/lib/deal-stages"
import { createDeal, updateDeal } from "@/app/(app)/deals/actions"

export function DealForm({ deal, contacts, companies, onSaved, trigger }) {
  const editing = Boolean(deal)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(deal?.title ?? "")
  const [value, setValue] = useState(deal?.value ?? "")
  const [stage, setStage] = useState(deal?.stage ?? DEAL_STAGES[0].key)
  const [contactId, setContactId] = useState(deal?.contact_id ? String(deal.contact_id) : "")
  const [companyId, setCompanyId] = useState(deal?.company_id ? String(deal.company_id) : "")
  const [closeDate, setCloseDate] = useState(deal?.expected_close_date?.slice?.(0, 10) ?? "")
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event) {
    event.preventDefault()
    if (!title.trim()) return

    const fields = {
      title,
      value,
      stage,
      contactId: contactId ? Number(contactId) : null,
      companyId: companyId ? Number(companyId) : null,
      expectedCloseDate: closeDate || null,
    }

    setError(null)
    startTransition(async () => {
      try {
        if (editing) {
          await updateDeal(deal.id, fields)
          onSaved?.({ ...deal, ...fields, contact_id: fields.contactId, company_id: fields.companyId })
        } else {
          const created = await createDeal(fields)
          onSaved?.(created)
          setTitle(""); setValue(""); setCloseDate("")
        }
        setOpen(false)
      } catch (err) {
        // Keep the dialog open with the input intact rather than closing it as
        // though the save had worked.
        console.error("[deal-form] save failed", { editing, err })
        setError(`Couldn't ${editing ? "update" : "create"} that deal.`)
      }
    })
  }

  const defaultTrigger = editing ? (
    <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
      <PencilIcon className="h-3.5 w-3.5" />
    </Button>
  ) : (
    <Button size="sm" className="gap-1.5 text-xs">
      <PlusIcon className="h-3.5 w-3.5" />
      New Deal
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? defaultTrigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Deal" : "New Deal"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isPending} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Value</Label>
              <Input
                type="number" min="0" step="1000"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Expected close</Label>
              <Input
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="text-xs"
                disabled={isPending}
              />
            </div>
          </div>

          {!editing && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="No contact" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">No contact</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name || c.email || `#${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="No company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">No company</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={!title.trim() || isPending}>
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
