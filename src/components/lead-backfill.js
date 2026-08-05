"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircleIcon, DownloadIcon, CheckCircleIcon } from "lucide-react"

/**
 * The client half of the lead backfill routes.
 *
 * Both APIs are deliberately one-chunk-per-request (see the doc comments in
 * src/app/api/facebook/backfill/route.js and .../google/backfill/route.js), so
 * something has to drive the loop. That is this file: it walks the chunks in
 * sequence, accumulating counts, and stops on the same conditions the routes
 * report. Sequential rather than parallel on purpose — the whole point of the
 * chunking is to stay well inside the platform's request budget, and firing
 * every form at once would hand Meta and Google a burst to rate-limit.
 *
 * Progress lives in component state, so navigating away abandons the run — and
 * unmounting aborts it rather than letting it run on invisibly. Without that,
 * coming back to a card that had reset to idle and pressing the button again
 * would put two loops on the same forms at once: harmless to the data (the
 * routes are idempotent) but it doubles the API calls and the second run
 * reports almost everything as `duplicate`, which reads like a failure.
 *
 * Work already committed stays committed — every chunk writes before it
 * returns, and re-running skips what it already took — so an abandoned run
 * costs a resume, not data.
 */

/** Hard stop on the drive loop. A route that kept handing back the same cursor
 *  would otherwise spin the browser forever; this turns that into a visible
 *  "stopped early" instead. Far above any real account's form/page count. */
const MAX_CHUNKS = 200

const EMPTY = { fetched: 0, imported: 0, matched: 0, duplicate: 0, skipped: 0, failed: 0 }

function add(counts, chunk) {
  return {
    fetched: counts.fetched + (chunk.fetched ?? 0),
    imported: counts.imported + (chunk.imported ?? 0),
    matched: counts.matched + (chunk.matched ?? 0),
    duplicate: counts.duplicate + (chunk.duplicate ?? 0),
    skipped: counts.skipped + (chunk.skipped ?? 0),
    failed: counts.failed + (chunk.failed ?? 0),
  }
}

/* Each number gets a sentence rather than a bare label — "matched 4" is
   ambiguous in a way that costs support time, and there is room here. */
const LEGEND = [
  ["imported", "new contacts created"],
  ["matched", "merged into an existing contact by email"],
  ["duplicate", "already in the CRM, left alone"],
  ["skipped", "no usable name, email, or phone"],
  ["failed", "errored — see server logs"],
]

function Summary({ counts }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm">
        Fetched <span className="font-medium tabular-nums">{counts.fetched.toLocaleString()}</span> lead
        {counts.fetched === 1 ? "" : "s"}.
      </p>
      <ul className="flex flex-col gap-1">
        {LEGEND.map(([key, label]) => (
          <li key={key} className="text-xs text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">{counts[key].toLocaleString()}</span> {label}
          </li>
        ))}
      </ul>
      {counts.imported > 0 && (
        <Link href="/data" className="text-xs underline underline-offset-2 w-fit">
          View them in Data
        </Link>
      )}
    </div>
  )
}

/**
 * Shared shell. The two providers differ only in how their chunks are
 * enumerated, so everything except `run` is identical between them.
 *
 * `run` is an async generator-ish callback: it receives a reporter it calls
 * once per chunk with ({label, ...counts}), and may throw to fail the run.
 */
function BackfillCard({ title, description, retention, run }) {
  const [status, setStatus] = useState("idle") // idle | running | done | error
  const [progress, setProgress] = useState("")
  const [counts, setCounts] = useState(EMPTY)
  const [error, setError] = useState("")
  const [warning, setWarning] = useState("")
  // Whether any chunk actually reported. A run can finish without one — no
  // forms to walk — and "Backfill complete / fetched 0" would then dress up
  // "we never looked" as a result, contradicting the warning next to it.
  const [ran, setRan] = useState(false)
  const abortRef = useRef(null)

  // Unmount cancels the in-flight chunk and, through the signal, the loop
  // driving it — see the note at the top of this file on why a run left
  // going after navigation is worse than one stopped.
  useEffect(() => () => abortRef.current?.abort(), [])

  async function handleRun() {
    const controller = new AbortController()
    abortRef.current = controller

    setStatus("running")
    setCounts(EMPTY)
    setError("")
    setWarning("")
    setRan(false)
    setProgress("Starting…")

    let running = EMPTY
    try {
      await run({
        signal: controller.signal,
        report(label, chunk) {
          running = add(running, chunk)
          setCounts(running)
          setProgress(label)
          setRan(true)
        },
        warn: setWarning,
      })
      setStatus("done")
      setProgress("")
    } catch (err) {
      // An abort is this component being unmounted, not a failure to report —
      // and there is no longer anything mounted to report it to.
      if (controller.signal.aborted) return
      console.error("[lead-backfill] run failed", err)
      setError(err?.message || "The backfill stopped unexpectedly.")
      setStatus("error")
      setProgress("")
    }
  }

  const running = status === "running"

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{retention}</p>

        {running && progress && <p className="text-sm text-muted-foreground">{progress}</p>}

        {status === "done" && ran && (
          <Alert>
            <CheckCircleIcon className="h-4 w-4" />
            <AlertDescription>Backfill complete.</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Not an error — a run that stopped at a ceiling with more waiting.
            Shown alongside the counts so a partial pull never reads as whole. */}
        {warning && (
          <Alert>
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        )}

        {ran && <Summary counts={counts} />}
      </CardContent>
      <CardFooter className="justify-end">
        <Button type="button" size="sm" className="gap-1.5" disabled={running} onClick={handleRun}>
          <DownloadIcon className="h-3.5 w-3.5" />
          {running ? "Importing…" : status === "done" || status === "error" ? "Run again" : "Import past leads"}
        </Button>
      </CardFooter>
    </Card>
  )
}

/** Reads a route's JSON, turning a non-2xx into a throw the card can render. */
async function callRoute(url, init) {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`)
  return body
}

/**
 * Facebook: enumerate Pages and their forms first (one cheap GET), then one
 * POST per form. Chunk = a form, which is also the resumption unit — a run
 * interrupted at form 7 of 12 leaves 1–6 imported and re-running skips them.
 */
export function FacebookBackfillCard() {
  async function run({ report, warn, signal }) {
    const { connected, pages } = await callRoute("/api/facebook/backfill", { signal })
    if (!connected) {
      throw new Error("No Facebook Pages are connected yet — connect one above first.")
    }

    const forms = pages.flatMap((page) =>
      (page.forms ?? []).map((form) => ({ pageId: page.pageId, pageName: page.pageName, ...form }))
    )

    const listErrors = pages.filter((page) => page.error)

    // Nothing to walk has two causes that want opposite reactions, so they get
    // separate messages rather than a shared "complete" with a zero count:
    // a stale token is something to go fix, an account with no lead forms is
    // not. Neither calls report(), so the counts stay hidden — a "0 leads"
    // summary would only dress up "we never looked" as a result.
    if (forms.length === 0) {
      if (listErrors.length > 0) {
        // Overwhelmingly this is a token minted before pages_manage_ads was
        // added to the OAuth scope — listing a Page's forms needs it, and
        // reconnecting is the only way to re-mint. Naming the permission
        // saves a round through the server logs to find that out.
        throw new Error(
          `Could not read forms for ${listErrors.map((p) => p.pageName).join(", ")}. ` +
            `Disconnect and reconnect the Page above — its token may predate the ` +
            `pages_manage_ads permission this needs.`
        )
      }
      warn("No lead forms found on the connected Pages — nothing to import.")
      return
    }

    if (listErrors.length > 0) {
      warn(
        `Could not list forms for ${listErrors.length} Page${listErrors.length === 1 ? "" : "s"} ` +
          `(${listErrors.map((p) => p.pageName).join(", ")}) — their token may need reconnecting. ` +
          `The counts below cover the rest.`
      )
    }

    const total = Math.min(forms.length, MAX_CHUNKS)
    for (let i = 0; i < total; i += 1) {
      const form = forms[i]
      const result = await callRoute(
        `/api/facebook/backfill?page_id=${encodeURIComponent(form.pageId)}&form_id=${encodeURIComponent(form.id)}`,
        { method: "POST", signal }
      )
      report(`Form ${i + 1} of ${total} — ${form.name || form.id}`, result)
    }

    if (forms.length > MAX_CHUNKS) {
      warn(`Stopped after ${MAX_CHUNKS} forms — ${forms.length - MAX_CHUNKS} were not walked. Run again to continue.`)
    }
  }

  return (
    <BackfillCard
      title="Import past Facebook leads"
      description="Pulls Lead Ads submissions the webhook never saw — anything collected before this CRM was connected."
      retention="Meta discards lead answers after 90 days, so only that window can be recovered. Safe to run more than once: leads already in the CRM are skipped, not duplicated."
      run={run}
    />
  )
}

/**
 * Google: the Reporting API returns submissions across every form in one
 * result set, so the chunk is a result page rather than a form. The route
 * hands back the cursor for the next call and null when the walk is done.
 */
export function GoogleBackfillCard() {
  async function run({ report, warn, signal }) {
    let pageToken = null
    let page = 0

    do {
      const url = pageToken
        ? `/api/google/backfill?page_token=${encodeURIComponent(pageToken)}`
        : "/api/google/backfill"
      const result = await callRoute(url, { method: "POST", signal })

      page += 1
      report(`Page ${page}…`, result)
      pageToken = result.nextPageToken ?? null
    } while (pageToken && page < MAX_CHUNKS)

    if (pageToken) {
      warn(`Stopped after ${MAX_CHUNKS} pages with more still waiting. Run again to continue.`)
    }
  }

  return (
    <BackfillCard
      title="Import past lead form submissions"
      description="Pulls Google Ads lead form submissions the webhook never saw — anything collected before Lead delivery was pointed at this CRM."
      retention="Google only retains lead form submissions for about 30 days, so only that window can be recovered. Safe to run more than once: leads already in the CRM are skipped, not duplicated."
      run={run}
    />
  )
}
