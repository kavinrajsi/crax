"use client"

import { useState, useTransition } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { GripVerticalIcon, CircleDollarSignIcon, UserIcon, CalendarIcon } from "lucide-react"
import { moveDeal } from "@/app/(app)/deals/actions"
import { DealDetailSheet } from "@/components/deal-detail-sheet"
import { CreateDealDialog } from "@/components/create-deal-dialog"

export const STAGE_COLUMNS = [
  { key: "Qualification", label: "Qualification", color: "#6366f1" },
  { key: "Proposal",      label: "Proposal",      color: "#f59e0b" },
  { key: "Negotiation",   label: "Negotiation",   color: "#3b82f6" },
  { key: "Closed-Won",    label: "Closed-Won",    color: "#22c55e" },
  { key: "Closed-Lost",   label: "Closed-Lost",   color: "#ef4444" },
]

function formatValue(v) {
  if (v == null) return null
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v)
}

function formatCloseDate(d) {
  if (!d) return null
  const date = new Date(d)
  const now = new Date()
  const diff = Math.round((date - now) / 86400000)
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true }
  if (diff === 0) return { label: "Closes today", overdue: false }
  return { label: `${diff}d left`, overdue: false }
}

/* ─── Deal Card ─────────────────────────────────────────────────────────── */

function DealCard({ deal, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `deal-${deal.id}`,
    data: { type: "deal", deal },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const closeInfo = formatCloseDate(deal.close_date)
  const displayValue = formatValue(deal.value)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-lg border border-border bg-card p-3 shadow-sm text-xs cursor-pointer hover:border-primary/40 transition-colors"
      onClick={() => onSelect(deal)}
    >
      <div className="flex items-start gap-2">
        <span
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVerticalIcon className="h-3.5 w-3.5" />
        </span>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <span className="font-semibold text-sm leading-snug break-words">{deal.title}</span>

          {displayValue && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <CircleDollarSignIcon className="h-3 w-3 shrink-0" />
              <span className="font-medium text-foreground">{displayValue}</span>
            </div>
          )}

          {deal.contact_name && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <UserIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{deal.contact_name}</span>
            </div>
          )}

          {closeInfo && (
            <div className={`flex items-center gap-1 ${closeInfo.overdue ? "text-destructive" : "text-muted-foreground"}`}>
              <CalendarIcon className="h-3 w-3 shrink-0" />
              <span>{closeInfo.label}</span>
            </div>
          )}

          {/* Probability bar */}
          {deal.probability != null && (
            <div className="w-full h-1 rounded-full bg-muted overflow-hidden mt-0.5">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{ width: `${deal.probability}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Overlay ────────────────────────────────────────────────────────────── */

function OverlayCard({ deal }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs w-64 opacity-90">
      <p className="font-semibold text-sm">{deal.title}</p>
      {deal.value != null && (
        <p className="text-muted-foreground mt-0.5">{formatValue(deal.value)}</p>
      )}
    </div>
  )
}

/* ─── DealsKanban ────────────────────────────────────────────────────────── */

export function DealsKanban({ deals: initialDeals, contacts, dealNotesMap }) {
  const [deals, setDeals] = useState(initialDeals)
  const [activeDeal, setActiveDeal] = useState(null)
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [sheetNotes, setSheetNotes] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function dealsForStage(stage) {
    return deals.filter((d) => d.stage === stage)
  }

  function handleSelect(deal) {
    setSelectedDeal(deal)
    setSheetNotes(dealNotesMap[deal.id] ?? [])
    setSheetOpen(true)
  }

  function onDragStart(event) {
    const data = event.active.data.current
    if (data?.type === "deal") setActiveDeal(data.deal)
  }

  function onDragEnd(event) {
    const { active, over } = event
    setActiveDeal(null)
    if (!over) return

    const deal = active.data.current?.deal
    if (!deal) return

    const overId = over.id.toString()
    let newStage = deal.stage

    if (overId.startsWith("col-")) {
      newStage = overId.replace("col-", "")
    } else if (overId.startsWith("deal-")) {
      const targetId = parseInt(overId.replace("deal-", ""))
      const target = deals.find((d) => d.id === targetId)
      if (target) newStage = target.stage
    }

    if (newStage === deal.stage) return

    setDeals((prev) => prev.map((d) => d.id === deal.id ? { ...d, stage: newStage } : d))
    startTransition(() => moveDeal(deal.id, newStage))
  }

  function handleCreated(deal) {
    setDeals((prev) => [...prev, deal])
  }

  function handleUpdated(updated) {
    setDeals((prev) => prev.map((d) => d.id === updated.id ? { ...d, ...updated } : d))
    setSelectedDeal((prev) => prev?.id === updated.id ? { ...prev, ...updated } : prev)
  }

  function handleDeleted(dealId) {
    setDeals((prev) => prev.filter((d) => d.id !== dealId))
  }

  const pipelineValue = deals
    .filter((d) => d.stage !== "Closed-Lost")
    .reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0)

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Pipeline: <span className="font-semibold text-foreground">{formatValue(pipelineValue)}</span>
          </span>
          <span className="text-sm text-muted-foreground">
            {deals.filter((d) => d.stage !== "Closed-Lost" && d.stage !== "Closed-Won").length} open deals
          </span>
        </div>
        <CreateDealDialog contacts={contacts} onCreated={handleCreated} />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGE_COLUMNS.map((col) => {
            const colDeals = dealsForStage(col.key)
            const colValue = colDeals.reduce((s, d) => s + (parseFloat(d.value) || 0), 0)
            const itemIds = colDeals.map((d) => `deal-${d.id}`)

            return (
              <div
                key={col.key}
                id={`col-${col.key}`}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/40"
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  <span className="flex-1 text-sm font-medium">{col.label}</span>
                  <Badge variant="secondary" className="text-xs tabular-nums">{colDeals.length}</Badge>
                </div>
                {colValue > 0 && (
                  <p className="text-[10px] text-muted-foreground px-3 pb-1.5">{formatValue(colValue)}</p>
                )}
                <Separator />

                {/* Cards */}
                <div
                  className="flex flex-col gap-2 overflow-y-auto p-2 min-h-[80px]"
                  style={{ maxHeight: "calc(100vh - 300px)" }}
                >
                  <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                    {colDeals.length === 0 ? (
                      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/50 border border-dashed border-border rounded-lg">
                        Drop here
                      </div>
                    ) : (
                      colDeals.map((deal) => (
                        <DealCard key={deal.id} deal={deal} onSelect={handleSelect} />
                      ))
                    )}
                  </SortableContext>
                </div>
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeDeal && <OverlayCard deal={activeDeal} />}
        </DragOverlay>
      </DndContext>

      {/* Detail sheet */}
      <DealDetailSheet
        deal={selectedDeal}
        contacts={contacts}
        notes={sheetNotes}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </>
  )
}
