"use client"

import { useState, useTransition } from "react"
import { PencilIcon, CheckIcon, XIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { updateContact } from "@/app/(app)/contacts/[id]/actions"

const FIELDS = [
  { key: "name",    label: "Name",    type: "text" },
  { key: "email",   label: "Email",   type: "email" },
  { key: "phone",   label: "Phone",   type: "tel" },
  { key: "company", label: "Company", type: "text" },
]

export function ContactEditForm({ contact }) {
  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState({
    name:    contact.name    ?? "",
    email:   contact.email   ?? "",
    phone:   contact.phone   ?? "",
    company: contact.company ?? "",
  })
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      await updateContact(contact.id, fields)
      setEditing(false)
    })
  }

  function handleCancel() {
    setFields({
      name:    contact.name    ?? "",
      email:   contact.email   ?? "",
      phone:   contact.phone   ?? "",
      company: contact.company ?? "",
    })
    setEditing(false)
  }

  if (!editing) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setEditing(true)}
        className="text-muted-foreground hover:text-foreground shrink-0"
        title="Edit contact"
      >
        <PencilIcon className="h-3.5 w-3.5" />
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs font-medium text-muted-foreground">Edit contact</p>
      {FIELDS.map(({ key, label, type }) => (
        <div key={key} className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{label}</label>
          <Input
            type={type}
            value={fields[key]}
            onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
            disabled={isPending}
          />
        </div>
      ))}
      <div className="flex gap-2 justify-end mt-1">
        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isPending}>
          <XIcon className="h-3.5 w-3.5" />
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          <CheckIcon className="h-3.5 w-3.5" />
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  )
}
