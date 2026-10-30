"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PlusIcon, Trash2Icon } from "lucide-react"

/* One stage: editable name and colour, saved on demand. */
function StageRow({ stage, disabled, onSave, onDelete }) {
  const [label, setLabel] = useState(stage.label)
  const [color, setColor] = useState(stage.color)
  const dirty = label.trim() !== stage.label || color.toLowerCase() !== stage.color.toLowerCase()

  return (
    <li className="flex items-center gap-2">
      <input
        type="color"
        value={color}
        onChange={(event) => setColor(event.target.value)}
        aria-label={`Colour for ${stage.label}`}
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
      />
      <input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        maxLength={60}
        aria-label={`Name of stage ${stage.label}`}
        className="h-8 flex-1 min-w-0 rounded-md border border-border bg-transparent px-2 text-sm"
      />
      {dirty && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !label.trim()}
          onClick={() => onSave(stage.key, label, color)}
        >
          Save
        </Button>
      )}
      <button
        type="button"
        onClick={() => onDelete(stage.key)}
        disabled={disabled}
        aria-label={`Delete stage ${stage.label}`}
        className="text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        <Trash2Icon className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

export function PipelineManager({
  pipeline,
  stages,
  pipelineCount,
  contactCount,
  isPending,
  onAddStage,
  onUpdateStage,
  onDeleteStage,
  onCreatePipeline,
  onDeletePipeline,
}) {
  const [label, setLabel] = useState("")
  const [color, setColor] = useState("#64748b")
  const [pipelineName, setPipelineName] = useState("")
  const [firstStage, setFirstStage] = useState("")

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4 text-sm">
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground">Stages in {pipeline.name}</h3>
        <ul className="flex flex-col gap-1.5">
          {stages.map((stage) => (
            <StageRow
              key={stage.key}
              stage={stage}
              disabled={isPending}
              onSave={onUpdateStage}
              onDelete={onDeleteStage}
            />
          ))}
        </ul>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!label.trim()) return
            onAddStage(label, color)
            setLabel("")
          }}
        >
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="New stage name"
            maxLength={60}
            className="h-9 flex-1 min-w-40 rounded-md border border-border bg-transparent px-2"
          />
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            aria-label="Stage colour"
            className="h-9 w-10 cursor-pointer rounded border border-border bg-transparent p-1"
          />
          <Button type="submit" size="sm" disabled={isPending || !label.trim()} className="gap-1.5">
            <PlusIcon className="h-3.5 w-3.5" />
            Add stage
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-xs font-semibold text-muted-foreground">New pipeline</h3>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!pipelineName.trim() || !firstStage.trim()) return
            onCreatePipeline(pipelineName, firstStage)
            setPipelineName("")
            setFirstStage("")
          }}
        >
          <input
            value={pipelineName}
            onChange={(event) => setPipelineName(event.target.value)}
            placeholder="Pipeline name, e.g. Enterprise"
            maxLength={60}
            className="h-9 flex-1 min-w-40 rounded-md border border-border bg-transparent px-2"
          />
          <input
            value={firstStage}
            onChange={(event) => setFirstStage(event.target.value)}
            placeholder="First stage, e.g. Qualified"
            maxLength={60}
            className="h-9 flex-1 min-w-40 rounded-md border border-border bg-transparent px-2"
          />
          <Button type="submit" size="sm" disabled={isPending || !pipelineName.trim() || !firstStage.trim()}>
            Create pipeline
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground">
          Add more stages above. Move contacts into the pipeline from their cards on the board.
        </p>
        {pipelineCount > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {contactCount === 0 ? `${pipeline.name} has no contacts.` : `${pipeline.name} has ${contactCount} contact${contactCount === 1 ? "" : "s"}; move them before deleting.`}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={isPending || contactCount > 0} onClick={onDeletePipeline}>
              Delete {pipeline.name}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
