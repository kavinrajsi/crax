"use client"

import { useState, useTransition } from "react"
import { PencilIcon, CheckIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet"
import { updateContact } from "@/app/(app)/contacts/[id]/actions"

const FIELDS = [
  { key: "name",    label: "Name",    type: "text" },
  { key: "email",   label: "Email",   type: "email" },
  { key: "phone",   label: "Phone",   type: "tel" },
  { key: "company", label: "Company", type: "text" },
]

function initialFields(contact) {
  return {
    name:    contact.name    ?? "",
    email:   contact.email   ?? "",
    phone:   contact.phone   ?? "",
    company: contact.company ?? "",
  }
}

export function ContactEditForm({ contact }) {
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState(() => initialFields(contact))
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()

  /* Reset the form to the row's values whenever the drawer opens, so a prior
     cancel or edit never leaves stale text behind. */
  function handleOpenChange(next) {
    if (next) {
      setFields(initialFields(contact))
      setError(null)
    }
    setOpen(next)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await updateContact(contact.id, fields)
        setOpen(false)
      } catch (err) {
        // Previously the rejection was swallowed and the form still closed, so
        // a failed save looked exactly like a successful one.
        console.error("[contact-edit] updateContact failed", { id: contact.id, err })
        setError("Couldn't save those changes.")
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => handleOpenChange(true)}
        className="text-muted-foreground hover:text-foreground shrink-0"
        title="Edit contact"
      >
        <PencilIcon className="h-3.5 w-3.5" />
      </Button>

      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit contact</SheetTitle>
          <SheetDescription>Update {contact.name || "this contact"}&rsquo;s details.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4">
          {FIELDS.map(({ key, label, type }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">{label}</label>
              <Input
                type={type}
                value={fields[key]}
                onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                disabled={isPending}
              />
            </div>
          ))}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <SheetClose
            render={<Button variant="outline" size="sm" disabled={isPending} />}
          >
            Cancel
          </SheetClose>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            <CheckIcon className="h-3.5 w-3.5" />
            {isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
