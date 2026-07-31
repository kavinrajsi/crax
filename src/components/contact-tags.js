"use client"

import { useState, useTransition } from "react"
import { XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { addTag, removeTag } from "@/app/(app)/contacts/[id]/actions"

export function ContactTags({ contactId, initialTags }) {
  const [tags, setTags] = useState(initialTags)
  const [input, setInput] = useState("")
  const [error, setError] = useState(null)
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
    setError(null)
    // Revert on failure — an optimistic tag that never saved looked identical to
    // a saved one until the page was reloaded.
    startTransition(async () => {
      try {
        await addTag(contactId, tag)
      } catch (err) {
        console.error("[contact-tags] addTag failed", { contactId, tag, err })
        setTags((prev) => prev.filter((t) => t.id !== optimistic.id))
        setError(`Couldn't add "${tag}".`)
      }
    })
  }

  function handleRemove(tagId) {
    const removed = tags.find((t) => t.id === tagId)
    setTags((prev) => prev.filter((t) => t.id !== tagId))
    setError(null)
    startTransition(async () => {
      try {
        await removeTag(tagId)
      } catch (err) {
        console.error("[contact-tags] removeTag failed", { tagId, err })
        if (removed) setTags((prev) => [...prev, removed])
        setError(`Couldn't remove "${removed?.tag ?? "tag"}".`)
      }
    })
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
      {error && <p className="text-xs text-destructive">{error}</p>}
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
