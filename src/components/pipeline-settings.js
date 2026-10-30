"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { PageShell, PageHeader } from "@/components/page"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PipelineManager } from "@/components/pipeline-manager"
import {
  createPipeline,
  deletePipeline,
  addStage,
  updateStage,
  deleteStage,
} from "@/app/(app)/pipeline/actions"

/**
 * Manage pipelines: pick one, then edit its stages (name and colour), add or
 * delete stages, create a pipeline, or delete an empty one.
 */
export function PipelineSettings({ pipelines, stages, contactCounts }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(pipelines[0]?.id ?? null)
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()

  const activePipeline = pipelines.find((pipeline) => pipeline.id === selectedId) ?? null
  const activeStages = stages
    .filter((stage) => stage.pipeline_id === selectedId)
    .map((stage) => ({ key: stage.key, label: stage.label, color: stage.color, resolved: stage.resolved }))

  /* Runs a server action, then refreshes the page's data. */
  function run(action, onDone) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (onDone) onDone(result)
        router.refresh()
      } catch (err) {
        console.error("[pipeline-settings] action failed", err)
        setError(err.message || "Something went wrong.")
      }
    })
  }

  return (
    <PageShell>
      <PageHeader title="Manage pipelines" description="Create pipelines, and set the name and colour of each stage." />

      <Link href="/pipeline" className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back to Pipeline
      </Link>

      <div className="flex items-center gap-2">
        <Select value={String(selectedId)} onValueChange={(value) => setSelectedId(Number(value))}>
          <SelectTrigger className="h-9 w-56 text-sm" aria-label="Pipeline">
            <SelectValue>{activePipeline?.name ?? "No pipelines"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={String(pipeline.id)}>{pipeline.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {activePipeline && (
        <PipelineManager
          pipeline={activePipeline}
          stages={activeStages}
          pipelineCount={pipelines.length}
          contactCount={contactCounts[activePipeline.id] ?? 0}
          isPending={isPending}
          onAddStage={(label, color) => run(() => addStage(selectedId, label, color))}
          onUpdateStage={(key, label, color) => run(() => updateStage(key, label, color))}
          onDeleteStage={(key) => run(() => deleteStage(key))}
          onCreatePipeline={(name, stage) => run(() => createPipeline(name, stage), (row) => setSelectedId(row.id))}
          onDeletePipeline={() =>
            run(
              () => deletePipeline(selectedId),
              () => setSelectedId(pipelines.find((pipeline) => pipeline.id !== selectedId)?.id ?? null)
            )
          }
        />
      )}
    </PageShell>
  )
}
