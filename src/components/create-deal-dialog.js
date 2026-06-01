"use client"

import { useState, useTransition } from "react"
import { PlusIcon } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createDeal } from "@/app/(app)/deals/actions"

const STAGES = ["Qualification", "Proposal", "Negotiation", "Closed-Won", "Closed-Lost"]

export function CreateDealDialog({ contacts, onCreated }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [value, setValue] = useState("")
  const [stage, setStage] = useState("Qualification")
  const [probability, setProbability] = useState("50")
  const [closeDate, setCloseDate] = useState("")
  const [contactId, setContactId] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return

    const payload = {
      title: title.trim(),
      value: value ? parseFloat(value) : null,
      stage,
      probability: parseInt(probability) || 50,
      close_date: closeDate || null,
      contact_id: contactId ? parseInt(contactId) : null,
    }

    startTransition(async () => {
      const deal = await createDeal(payload)
      onCreated?.({ ...deal, contact_name: contacts.find(c => c.id === deal.contact_id)?.name ?? null })
      setTitle("")
      setValue("")
      setStage("Qualification")
      setProbability("50")
      setCloseDate("")
      setContactId("")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5 text-xs" />}>
        <PlusIcon className="h-3.5 w-3.5" />
        New Deal
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Deal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Acme Corp - Website Redesign" disabled={isPending} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Value */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Value</Label>
              <Input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" disabled={isPending} />
            </div>

            {/* Probability */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Probability %</Label>
              <Input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} disabled={isPending} />
            </div>
          </div>

          {/* Stage */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Close date */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Expected close date</Label>
            <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className="text-xs" disabled={isPending} />
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Linked contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name || c.email || `#${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={!title.trim() || isPending}>
              {isPending ? "Creating…" : "Create Deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
