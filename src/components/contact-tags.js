"use client"

import { useState, useTransition } from "react"
import { XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { addTag, removeTag } from "@/app/(app)/contacts/[id]/actions"

export function ContactTags({ contactId, initialTags }) {
  const [tags, setTags] = useState(initialTags)
  const [input, setInput] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleKeyDown(e) {
    if (e.key !== "Enter") return
    e.preventDefault()
    const tag = input.trim().toLowerCase()
    if (!tag || tags.some((t) => t.tag === tag)) {
      setInput("")
      return
    }
    const optimistic = { id: Date.now(), contact_id: contactId, tag, created_at: new Date().toISOString() }
    setTags((prev) => [...prev, optimistic])
    setInput("")
    startTransition(() => addTag(contactId, tag))
  }

  function handleRemove(tagId) {
    setTags((prev) => prev.filter((t) => t.id !== tagId))
    startTransition(() => removeTag(tagId))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
        {tags.map((t) => (
          <Badge key={t.id} variant="outline" className="text-xs gap-1 pr-1">
            {t.tag}
            <button
              onClick={() => handleRemove(t.id)}
              className="hover:text-destructive transition-colors leading-none ml-0.5"
              disabled={isPending}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {tags.length === 0 && (
          <span className="text-xs text-muted-foreground/50">No tags yet</span>
        )}
      </div>
      <Input
        placeholder="Type a tag and press Enter…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-7 text-xs w-56"
        disabled={isPending}
      />
    </div>
  )
}
