"use client"

import { useState, useTransition, useRef } from "react"
import { UploadIcon, CheckCircleIcon, AlertTriangleIcon, DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
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

const IMPORTABLE_FIELDS = [
  { value: "name",       label: "Name" },
  { value: "email",      label: "Email" },
  { value: "phone",      label: "Phone" },
  { value: "company",    label: "Company" },
  { value: "source_url", label: "Source URL" },
  { value: "needs",      label: "Needs (comma-separated)" },
  { value: "__skip__",   label: "— Skip —" },
]

const SAMPLE_CSV = [
  ["Name", "Email", "Phone", "Company", "Source URL", "Needs"],
  ["Jane Doe", "jane@example.com", "+1 555 0100", "Acme Inc", "https://example.com/contact", "branding, web design"],
  ["John Smith", "john@example.com", "+1 555 0101", "Beta LLC", "https://example.com/pricing", "seo"],
].map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",")).join("\n")

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "sample-contacts.csv"
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  function parseRow(line) {
    const result = []
    let cur = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === "," && !inQuotes) { result.push(cur.trim()); cur = "" }
      else { cur += ch }
    }
    result.push(cur.trim())
    return result
  }

  const headers = parseRow(lines[0]).map((h) => h.replace(/^"|"$/g, ""))
  const rows = lines.slice(1, 6).map((l) => {
    const cells = parseRow(l).map((c) => c.replace(/^"|"$/g, ""))
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: cells[i] ?? "" }), {})
  })
  const allRows = lines.slice(1).map((l) => {
    const cells = parseRow(l).map((c) => c.replace(/^"|"$/g, ""))
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: cells[i] ?? "" }), {})
  })

  return { headers, previewRows: rows, allRows }
}

function guessMapping(headers) {
  const map = {}
  const lower = (s) => s.toLowerCase().replace(/[^a-z]/g, "")
  headers.forEach((h) => {
    const l = lower(h)
    if (l.includes("name"))   map[h] = "name"
    else if (l.includes("email")) map[h] = "email"
    else if (l.includes("phone") || l.includes("mobile")) map[h] = "phone"
    else if (l.includes("company") || l.includes("org")) map[h] = "company"
    else if (l.includes("source") || l.includes("url")) map[h] = "source_url"
    else if (l.includes("need") || l.includes("service")) map[h] = "needs"
    else map[h] = "__skip__"
  })
  return map
}

export function CsvImportDialog({ onImported }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState("upload") // upload | map | result
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [result, setResult] = useState(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = parseCSV(ev.target.result)
      if (data.headers.length === 0) return
      setParsed(data)
      setMapping(guessMapping(data.headers))
      setStep("map")
    }
    reader.readAsText(file)
  }

  function handleImport() {
    // Optional chain is load-bearing: React Compiler hoists this property read
    // into the render-phase memo dependency check, where `parsed` is still null.
    const rows = (parsed?.allRows ?? []).map((row) => {
      const mapped = {}
      for (const [csvCol, field] of Object.entries(mapping)) {
        if (field && field !== "__skip__") {
          mapped[field] = row[csvCol] ?? ""
        }
      }
      return mapped
    })

    startTransition(async () => {
      try {
        const res = await fetch("/api/contacts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        })
        // res.ok was never checked, so a 401 or 500 was reported as a success
        // with `inserted: undefined`.
        if (!res.ok) {
          const detail = res.status === 401 ? "Your session expired — sign in again." : ""
          throw new Error(`Import failed (${res.status}). ${detail}`.trim())
        }
        const data = await res.json()
        setResult(data)
        setStep("result")
        onImported?.()
      } catch (error) {
        console.error("[csv-import] request failed", error)
        setResult({ error: error.message })
        setStep("result")
      }
    })
  }

  function handleClose(v) {
    setOpen(v)
    if (!v) {
      setStep("upload")
      setParsed(null)
      setMapping({})
      setResult(null)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5 text-xs" />}>
        <UploadIcon className="h-3.5 w-3.5" />
        Import CSV
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import Contacts from CSV"}
            {step === "map" && `Map Columns — ${parsed?.allRows.length} rows detected`}
            {step === "result" && (result?.error ? "Import Failed" : "Import Complete")}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="flex flex-col gap-4 mt-2">
            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-10 cursor-pointer hover:bg-muted/50 transition-colors gap-3">
              <UploadIcon className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload a CSV file</p>
                <p className="text-xs text-muted-foreground mt-1">First row must be column headers</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <DownloadIcon className="h-3 w-3" />
              Download sample CSV
            </button>
          </div>
        )}

        {/* Step 2: Map columns */}
        {step === "map" && parsed && (
          <div className="flex flex-col gap-4 mt-2">
            <p className="text-xs text-muted-foreground">Map your CSV columns to contact fields. Unneeded columns can be skipped.</p>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {parsed.headers.map((h) => (
                <div key={h} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-32 truncate shrink-0" title={h}>{h}</span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <Select value={mapping[h] ?? "__skip__"} onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v }))}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IMPORTABLE_FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <p className="text-[10px] text-muted-foreground px-3 py-1.5 bg-muted/40 border-b">Preview (first {parsed.previewRows.length} rows)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {parsed.headers.map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">
                          {mapping[h] && mapping[h] !== "__skip__"
                            ? IMPORTABLE_FIELDS.find(f => f.value === mapping[h])?.label ?? h
                            : <span className="line-through opacity-50">{h}</span>
                          }
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.previewRows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {parsed.headers.map((h) => (
                          <td key={h} className={`px-3 py-1.5 whitespace-nowrap ${mapping[h] === "__skip__" ? "opacity-40" : ""}`}>
                            {row[h] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter showCloseButton>
              <Button size="sm" onClick={handleImport} disabled={isPending}>
                {isPending ? "Importing…" : `Import ${parsed.allRows.length} rows`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Result */}
        {step === "result" && result && (
          <div className="flex flex-col items-center gap-4 py-4">
            {result.error ? (
              <>
                <AlertTriangleIcon className="h-12 w-12 text-destructive" />
                <p className="text-sm text-center max-w-sm">{result.error}</p>
                <p className="text-xs text-muted-foreground text-center">
                  Nothing was imported. Your file is unchanged — try again.
                </p>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-12 w-12 text-green-500" />
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{result.inserted}</p>
                    <p className="text-xs text-muted-foreground">imported</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                    <p className="text-xs text-muted-foreground">skipped</p>
                  </div>
                  {result.failed > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-destructive">{result.failed}</p>
                      <p className="text-xs text-muted-foreground">failed</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Skipped rows have duplicate emails or missing name and email.
                  {result.failed > 0 && " Failed rows hit a database error."}
                </p>
                {result.errors?.length > 0 && (
                  <ul className="text-xs text-destructive/80 w-full max-w-sm space-y-0.5">
                    {result.errors.map((e, i) => (
                      <li key={i} className="truncate">{e}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <Button size="sm" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
