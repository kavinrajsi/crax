"use client"

import { useEffect } from "react"
import { AlertTriangleIcon, RotateCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Route-level boundary for the (app) group. Every page here is
 * `dynamic = "force-dynamic"` and queries the database at request time, so an
 * unreachable DB used to surface as the framework's default error screen with
 * no way back.
 */
export default function AppError({ error, reset }) {
  useEffect(() => {
    // `digest` is the only handle on the real message — Next redacts the rest
    // in production. Log it so it can be matched against the server output.
    console.error("[app] route error", error?.digest ?? "", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <AlertTriangleIcon className="h-8 w-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          This page couldn&apos;t load. It is usually a temporary database hiccup —
          retrying often works.
        </p>
        {error?.digest && (
          <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
            ref: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} size="sm" className="gap-1.5">
        <RotateCwIcon className="h-3.5 w-3.5" />
        Try again
      </Button>
    </div>
  )
}
