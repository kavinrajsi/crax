"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVerticalIcon, UserIcon, BuildingIcon, CalendarIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { DEAL_STAGES, pipelineValue, formatMoney, isOpenStage } from "@/lib/deal-stages"
import { moveDeal, deleteDeal } from "@/app/(app)/deals/actions"
import { DealForm } from "@/components/deal-form"

function DealCard({ deal, contacts, companies, onSaved, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `deal-${deal.id}`,
    data: { type: "deal", deal },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="group rounded-lg border border-border bg-card p-3 shadow-sm text-xs"
    >
      <div className="flex items-start gap-2">
        <span
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity touch-none"
        >
          <GripVerticalIcon className="h-3.5 w-3.5" />
        </span>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-sm leading-snug break-words">{deal.title}</span>
            <span className="font-medium whitespace-nowrap shrink-0 tabular-nums">
              {formatMoney(deal.value)}
            </span>
          </div>

          {deal.contact_id && (
            <Link
              href={`/contacts/${deal.contact_id}`}
              className="flex items-center gap-1 text-muted-foreground hover:text-primary w-fit"
            >
              <UserIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{deal.contact_name || `#${deal.contact_id}`}</span>
            </Link>
          )}

          {deal.company_id && (
            <Link
              href={`/companies/${deal.company_id}`}
              className="flex items-center gap-1 text-muted-foreground hover:text-primary w-fit"
            >
              <BuildingIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{deal.company_name}</span>
            </Link>
          )}

          {deal.expected_close_date && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <CalendarIcon className="h-3 w-3 shrink-0" />
              <span>{new Date(deal.expected_close_date).toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric",
              })}</span>
            </div>
          )}

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity -ml-1.5">
            <DealForm deal={deal} contacts={contacts} companies={companies} onSaved={onSaved} />
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(deal)}
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DealsBoard({ deals: initialDeals, contacts, companies }) {
  const [deals, setDeals] = useState(initialDeals)
  const [activeDeal, setActiveDeal] = useState(null)
  const [error, setError] = useState(null)
  const [, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const forStage = (stage) => deals.filter((d) => d.stage === stage)

  function handleSaved(saved) {
    setDeals((prev) => {
      const exists = prev.some((d) => d.id === saved.id)
      return exists ? prev.map((d) => (d.id === saved.id ? { ...d, ...saved } : d)) : [...prev, saved]
    })
  }

  function handleDelete(deal) {
    // Snapshot before removing: a rejected delete must put the card back rather
    // than leaving it missing from a board the database still has it on.
    const previous = deals
    setDeals((prev) => prev.filter((d) => d.id !== deal.id))
    setError(null)
    startTransition(async () => {
      try {
        await deleteDeal(deal.id)
      } catch (err) {
        console.error("[deals] delete failed", { id: deal.id, err })
        setDeals(previous)
        setError(`Couldn't delete "${deal.title}". It has been restored.`)
      }
    })
  }

  function onDragEnd(event) {
    const { active, over } = event
    setActiveDeal(null)
    if (!over) return

    const deal = active.data.current?.deal
    if (!deal) return

    const overId = String(over.id)
    let targetStage = deal.stage
    if (overId.startsWith("stage-")) targetStage = overId.replace("stage-", "")
    else if (overId.startsWith("deal-")) {
      const target = deals.find((d) => `deal-${d.id}` === overId)
      if (target) targetStage = target.stage
    }
    if (targetStage === deal.stage) return

    const previous = deals
    const moved = { ...deal, stage: targetStage }
    const nextOrder = [...forStage(targetStage).filter((d) => d.id !== deal.id), moved]

    setDeals((prev) => prev.map((d) => (d.id === deal.id ? moved : d)))
    setError(null)
    startTransition(async () => {
      try {
        await moveDeal(deal.id, targetStage, nextOrder.map((d) => d.id))
      } catch (err) {
        console.error("[deals] moveDeal failed", { id: deal.id, targetStage, err })
        setDeals(previous)
        setError("Couldn't move that deal. It has been put back.")
      }
    })
  }

  const openValue = pipelineValue(deals)
  const wonValue = deals
    .filter((d) => d.stage === "won")
    .reduce((sum, d) => sum + Number(d.value ?? 0), 0)

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary" className="text-xs">
          Open pipeline {formatMoney(openValue)}
        </Badge>
        <Badge variant="secondary" className="text-xs">Won {formatMoney(wonValue)}</Badge>
        <div className="ml-auto">
          <DealForm contacts={contacts} companies={companies} onSaved={handleSaved} />
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveDeal(e.active.data.current?.deal ?? null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {DEAL_STAGES.map((stage) => {
            const stageDeals = forStage(stage.key)
            const stageValue = stageDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0)
            return (
              <div
                key={stage.key}
                id={`stage-${stage.key}`}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/40"
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                  <span className="flex-1 text-sm font-medium">{stage.label}</span>
                  <Badge variant="secondary" className="text-xs tabular-nums">{stageDeals.length}</Badge>
                </div>
                {stageValue > 0 && (
                  <p className={`px-3 pb-2 text-xs tabular-nums ${isOpenStage(stage.key) ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                    {formatMoney(stageValue)}
                  </p>
                )}

                <Separator />

                <div
                  id={`stage-${stage.key}`}
                  className="flex flex-col gap-2 overflow-y-auto p-2 min-h-[80px]"
                  style={{ maxHeight: "calc(100vh - 300px)" }}
                >
                  <SortableContext
                    items={stageDeals.map((d) => `deal-${d.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {stageDeals.length === 0 ? (
                      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/50 border border-dashed border-border rounded-lg">
                        Drop here
                      </div>
                    ) : (
                      stageDeals.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          contacts={contacts}
                          companies={companies}
                          onSaved={handleSaved}
                          onDelete={handleDelete}
                        />
                      ))
                    )}
                  </SortableContext>
                </div>
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeDeal && (
            <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs w-64 opacity-90">
              <p className="font-semibold text-sm">{activeDeal.title}</p>
              <p className="text-muted-foreground mt-0.5 tabular-nums">{formatMoney(activeDeal.value)}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
