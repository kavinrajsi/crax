"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { setSourceColor } from "@/app/(app)/pipeline/actions"
import { PIPELINE_SOURCES, SOURCE_DEFAULT_COLORS } from "@/lib/contact-sources"
import { AlertCircleIcon } from "lucide-react"

/* Colour for each pipeline tag (All / Madarth / Search ...). Saved per user and
   shown on the Pipeline board. */
export function PipelineTagsSettings({ initialColors }) {
  const [colors, setColors] = useState(initialColors)
  const [error, setError] = useState(null)

  async function handleColor(key, color) {
    setColors((prev) => ({ ...prev, [key]: color }))
    setError(null)
    try {
      await setSourceColor(key, color)
    } catch (err) {
      console.error("[settings] tag colour save failed", err)
      setError(err.message || "Couldn't save that colour.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline tags</CardTitle>
        <CardDescription>The colour each pipeline tag shows on the Pipeline board. Saved to your account.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {PIPELINE_SOURCES.map((source) => {
          const color = colors[source.key] ?? SOURCE_DEFAULT_COLORS[source.key] ?? "#64748b"
          return (
            <div key={source.key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium" style={{ color }}>{source.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-muted-foreground">{color}</span>
                <input
                  type="color"
                  value={color}
                  aria-label={`Colour for ${source.label}`}
                  onChange={(event) => handleColor(source.key, event.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-1"
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
