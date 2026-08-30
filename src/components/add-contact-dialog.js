"use client"

import { useState, useTransition } from "react"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { CONTACT_STATUSES, DEFAULT_CONTACT_STATUS } from "@/lib/contact-statuses"
import { createContact } from "@/app/(app)/data/actions"

const OTHER_SOURCE = "__other__"

const EMPTY = { name: "", email: "", phone: "", company: "", sourceUrl: "", customSource: "", message: "", needs: "", status: DEFAULT_CONTACT_STATUS }

export function AddContactDialog({ sources = [] }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  function handleClose(v) {
    setOpen(v)
    if (!v) {
      setForm(EMPTY)
      setError(null)
    }
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await createContact({
          ...form,
          sourceUrl: form.sourceUrl === OTHER_SOURCE ? form.customSource : form.sourceUrl,
          needs: form.needs.split(",").map((n) => n.trim()).filter(Boolean),
        })
        if (result?.error) {
          setError(result.error)
          return
        }
        handleClose(false)
      } catch (err) {
        console.error("[add-contact] createContact failed", err)
        setError("Couldn't save the lead. Try again.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5 text-xs" />}>
        <PlusIcon className="h-3.5 w-3.5" />
        Add Lead
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Lead</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Name" value={form.name} onChange={set("name")} autoFocus />
            <Input placeholder="Email" type="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Phone" value={form.phone} onChange={set("phone")} />
            <Input placeholder="Company" value={form.company} onChange={set("company")} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Source</p>
            <Select value={form.sourceUrl || undefined} onValueChange={(v) => setForm((f) => ({ ...f, sourceUrl: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a source (optional)" /></SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
                <SelectItem value={OTHER_SOURCE}>Other…</SelectItem>
              </SelectContent>
            </Select>
            {form.sourceUrl === OTHER_SOURCE && (
              <Input
                className="mt-2"
                placeholder="Custom source URL"
                value={form.customSource}
                onChange={set("customSource")}
              />
            )}
          </div>
          <Textarea
            placeholder="Message (optional)"
            value={form.message}
            onChange={set("message")}
            className="min-h-20 resize-none"
          />
          <Input placeholder="Needs, comma-separated (optional)" value={form.needs} onChange={set("needs")} />
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Status</p>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTACT_STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter showCloseButton>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || (!form.name.trim() && !form.email.trim())}
          >
            {isPending ? "Saving…" : "Save lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
