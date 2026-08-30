"use client"

import { useState, useTransition } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core"
import { useKanbanSensors } from "@/hooks/use-kanban-sensors"
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  PlusIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  PencilIcon,
  GripVerticalIcon,
  KanbanSquareIcon,
} from "lucide-react"
import {
  createBoard,
  deleteBoard,
  createColumn,
  updateColumn,
  deleteColumn,
  createCard,
  updateCard,
  deleteCard,
  moveCard,
  reorderColumns,
} from "@/app/(app)/pipeline/actions"

/* ─── colour palette for columns ─────────────────────────────────────── */

const COLUMN_COLORS = [
  { label: "Slate",  value: "#64748b" },
  { label: "Blue",   value: "#3b82f6" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Green",  value: "#22c55e" },
  { label: "Yellow", value: "#eab308" },
  { label: "Orange", value: "#f97316" },
  { label: "Red",    value: "#ef4444" },
  { label: "Pink",   value: "#ec4899" },
]

/* ─── Card item ───────────────────────────────────────────────────────── */

function KanbanCard({ card, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `card-${card.id}`, data: { type: "card", card } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-lg border border-border bg-card p-3 shadow-sm text-sm"
    >
      <div className="flex items-start gap-2">
        <span
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity touch-none"
        >
          <GripVerticalIcon className="h-3.5 w-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium leading-snug break-words">{card.title}</p>
          {card.description && (
            <p className="text-xs text-muted-foreground mt-1 break-words line-clamp-2">
              {card.description}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity" />}
          >
            <MoreHorizontalIcon className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(card)}>
              <PencilIcon className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(card.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2Icon className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

/* ─── Column ──────────────────────────────────────────────────────────── */

function KanbanColumn({ column, cards, onAddCard, onEditCard, onDeleteCard, onEditColumn, onDeleteColumn }) {
  const [addingCard, setAddingCard] = useState(false)
  const [title, setTitle] = useState("")
  const [desc, setDesc] = useState("")
  const [saving, setSaving] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `col-${column.id}`, data: { type: "column", column } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  async function handleAddCard() {
    if (!title.trim()) return
    setSaving(true)
    await onAddCard(column.id, title.trim(), desc.trim() || null)
    setTitle("")
    setDesc("")
    setAddingCard(false)
    setSaving(false)
  }

  const cardIds = cards.map((c) => `card-${c.id}`)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/40"
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground touch-none"
        >
          <GripVerticalIcon className="h-4 w-4" />
        </span>
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: column.color }}
        />
        <span className="flex-1 text-sm font-medium truncate">{column.name}</span>
        <Badge variant="secondary" className="text-xs tabular-nums">{cards.length}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button className="rounded p-0.5 text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors" />}
          >
            <MoreHorizontalIcon className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditColumn(column)}>
              <PencilIcon className="h-4 w-4" /> Edit column
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDeleteColumn(column.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2Icon className="h-4 w-4" /> Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      {/* Cards */}
      <div className="flex flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onEdit={onEditCard}
              onDelete={onDeleteCard}
            />
          ))}
        </SortableContext>

        {/* Add card inline */}
        {addingCard ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5">
            <Input
              autoFocus
              placeholder="Card title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCard() }}
              className="h-7 text-xs"
            />
            <Textarea
              placeholder="Description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="text-xs min-h-14 resize-none"
            />
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs" onClick={handleAddCard} disabled={saving || !title.trim()}>
                {saving ? "Adding…" : "Add card"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingCard(false); setTitle(""); setDesc("") }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingCard(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add card
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── KanbanBoard ─────────────────────────────────────────────────────── */

export function KanbanBoard({ boards: initialBoards, columns: initialColumns, cards: initialCards }) {
  const [boards, setBoards] = useState(initialBoards)
  const [columns, setColumns] = useState(initialColumns)
  const [cards, setCards] = useState(initialCards)
  const [activeBoardId, setActiveBoardId] = useState(initialBoards[0]?.id ?? null)
  const [boardError, setBoardError] = useState(null)
  const [, startTransition] = useTransition()

  // DnD state
  const [activeItem, setActiveItem] = useState(null)

  // Dialogs
  const [newBoardOpen, setNewBoardOpen] = useState(false)
  const [newBoardName, setNewBoardName] = useState("")
  const [boardSaving, setBoardSaving] = useState(false)

  const [newColOpen, setNewColOpen] = useState(false)
  const [newColName, setNewColName] = useState("")
  const [newColColor, setNewColColor] = useState(COLUMN_COLORS[0].value)
  const [colSaving, setColSaving] = useState(false)

  const [editColOpen, setEditColOpen] = useState(false)
  const [editingCol, setEditingCol] = useState(null)
  const [editColName, setEditColName] = useState("")
  const [editColColor, setEditColColor] = useState("")

  const [editCardOpen, setEditCardOpen] = useState(false)
  const [editingCard, setEditingCard] = useState(null)
  const [editCardTitle, setEditCardTitle] = useState("")
  const [editCardDesc, setEditCardDesc] = useState("")

  const activeBoard = boards.find((b) => b.id === activeBoardId)
  const boardColumns = columns
    .filter((c) => c.board_id === activeBoardId)
    .sort((a, b) => a.position - b.position)
  const colIds = boardColumns.map((c) => `col-${c.id}`)

  const cardsForColumn = (colId) =>
    cards.filter((c) => c.column_id === colId).sort((a, b) => a.position - b.position)

  const sensors = useKanbanSensors()

  function onDragStart(event) {
    setActiveItem(event.active.data.current)
  }

  async function onDragEnd(event) {
    const { active, over } = event
    setActiveItem(null)
    if (!over || active.id === over.id) return

    const aData = active.data.current
    const oData = over.data.current

    /* ── card dropped ── */
    if (aData?.type === "card") {
      const card = aData.card
      let targetColId = card.column_id

      if (oData?.type === "card") targetColId = oData.card.column_id
      else if (oData?.type === "column") targetColId = oData.column.id

      const targetCards = cards
        .filter((c) => c.column_id === targetColId)
        .sort((a, b) => a.position - b.position)

      let newOrder
      if (oData?.type === "card" && oData.card.column_id === targetColId) {
        const oldIdx = targetCards.findIndex((c) => c.id === card.id)
        const newIdx = targetCards.findIndex((c) => c.id === oData.card.id)
        newOrder = arrayMove(targetCards, oldIdx === -1 ? targetCards.length : oldIdx, newIdx)
      } else {
        const without = targetCards.filter((c) => c.id !== card.id)
        newOrder = [...without, { ...card, column_id: targetColId }]
      }

      // Snapshot for rollback — the transition used to drop the promise, so a
      // rejected move left the card in the wrong column permanently.
      const previousCards = cards
      setBoardError(null)
      setCards((prev) => [
        ...prev.filter((c) => c.column_id !== targetColId && c.id !== card.id),
        ...newOrder.map((c, i) => ({ ...c, position: i })),
      ])

      startTransition(async () => {
        try {
          await moveCard(card.id, targetColId, newOrder.map((c) => c.id))
        } catch (err) {
          console.error("[kanban] moveCard failed", err)
          setCards(previousCards)
          setBoardError("Couldn't move that card. It has been put back.")
        }
      })
      return
    }

    /* ── column reordered ── */
    if (aData?.type === "column" && oData?.type === "column") {
      const oldIdx = boardColumns.findIndex((c) => `col-${c.id}` === active.id)
      const newIdx = boardColumns.findIndex((c) => `col-${c.id}` === over.id)
      const reordered = arrayMove(boardColumns, oldIdx, newIdx)
      const previousColumns = columns
      setBoardError(null)
      setColumns((prev) => [
        ...prev.filter((c) => c.board_id !== activeBoardId),
        ...reordered.map((c, i) => ({ ...c, position: i })),
      ])
      startTransition(async () => {
        try {
          await reorderColumns(reordered.map((c) => c.id))
        } catch (err) {
          console.error("[kanban] reorderColumns failed", err)
          setColumns(previousColumns)
          setBoardError("Couldn't reorder columns. The order has been put back.")
        }
      })
    }
  }

  /* ── Board actions ── */
  async function handleCreateBoard() {
    if (!newBoardName.trim()) return
    setBoardSaving(true)
    setBoardError(null)
    try {
      const board = await createBoard(newBoardName.trim())
      setBoards((p) => [...p, board])
      setActiveBoardId(board.id)
      setNewBoardName("")
      setNewBoardOpen(false)
    } catch (err) {
      console.error("[kanban] createBoard failed", err)
      setBoardError("Couldn't create that board.")
    } finally {
      // finally, not the happy path — a throw used to leave this true forever,
      // wedging the dialog open with a permanently disabled Save button.
      setBoardSaving(false)
    }
  }

  async function handleDeleteBoard(boardId) {
    try {
      await deleteBoard(boardId)
    } catch (err) {
      console.error("[kanban] deleteBoard failed", err)
      setBoardError("Couldn't delete that board.")
      return
    }
    setBoards((p) => p.filter((b) => b.id !== boardId))
    setColumns((p) => p.filter((c) => c.board_id !== boardId))
    setCards((p) => {
      const removed = new Set(columns.filter((c) => c.board_id === boardId).map((c) => c.id))
      return p.filter((c) => !removed.has(c.column_id))
    })
    if (activeBoardId === boardId) setActiveBoardId(boards.find((b) => b.id !== boardId)?.id ?? null)
  }

  /* ── Column actions ── */
  async function handleCreateColumn() {
    if (!newColName.trim()) return
    setColSaving(true)
    const col = await createColumn(activeBoardId, newColName.trim(), newColColor)
    setColumns((p) => [...p, col])
    setNewColName("")
    setNewColColor(COLUMN_COLORS[0].value)
    setNewColOpen(false)
    setColSaving(false)
  }

  function openEditColumn(col) {
    setEditingCol(col)
    setEditColName(col.name)
    setEditColColor(col.color)
    setEditColOpen(true)
  }

  async function handleEditColumn() {
    if (!editColName.trim()) return
    await updateColumn(editingCol.id, editColName.trim(), editColColor)
    setColumns((p) => p.map((c) => c.id === editingCol.id ? { ...c, name: editColName.trim(), color: editColColor } : c))
    setEditColOpen(false)
  }

  async function handleDeleteColumn(colId) {
    await deleteColumn(colId)
    setColumns((p) => p.filter((c) => c.id !== colId))
    setCards((p) => p.filter((c) => c.column_id !== colId))
  }

  /* ── Card actions ── */
  async function handleAddCard(colId, title, description) {
    const card = await createCard(colId, title, description)
    setCards((p) => [...p, card])
  }

  function openEditCard(card) {
    setEditingCard(card)
    setEditCardTitle(card.title)
    setEditCardDesc(card.description ?? "")
    setEditCardOpen(true)
  }

  async function handleEditCard() {
    if (!editCardTitle.trim()) return
    await updateCard(editingCard.id, editCardTitle.trim(), editCardDesc.trim() || null)
    setCards((p) => p.map((c) => c.id === editingCard.id ? { ...c, title: editCardTitle.trim(), description: editCardDesc.trim() || null } : c))
    setEditCardOpen(false)
  }

  async function handleDeleteCard(cardId) {
    await deleteCard(cardId)
    setCards((p) => p.filter((c) => c.id !== cardId))
  }

  /* ── Overlay card ── */
  const overlayCard = activeItem?.type === "card" ? activeItem.card : null
  const overlayCol  = activeItem?.type === "column" ? activeItem.column : null

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {boardError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {boardError}
        </p>
      )}
      {/* Board selector bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {boards.map((b) => (
          <div key={b.id} className="flex items-center gap-0.5">
            <button
              onClick={() => setActiveBoardId(b.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                b.id === activeBoardId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <KanbanSquareIcon className="h-3.5 w-3.5" />
              {b.name}
            </button>
            {boards.length > 1 && (
              <button
                onClick={() => handleDeleteBoard(b.id)}
                className="rounded p-1 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete board"
              >
                <Trash2Icon className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={() => setNewBoardOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          New board
        </button>
      </div>

      {/* Board content */}
      {!activeBoard ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <KanbanSquareIcon className="h-10 w-10 opacity-30" />
          <p className="text-sm">No board selected. Create one above.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
              {boardColumns.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  cards={cardsForColumn(col.id)}
                  onAddCard={handleAddCard}
                  onEditCard={openEditCard}
                  onDeleteCard={handleDeleteCard}
                  onEditColumn={openEditColumn}
                  onDeleteColumn={handleDeleteColumn}
                />
              ))}
            </SortableContext>

            {/* Add column button */}
            <button
              onClick={() => setNewColOpen(true)}
              className="flex h-12 w-72 shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add column
            </button>
          </div>

          {/* Drag overlays */}
          <DragOverlay>
            {overlayCard && (
              <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-sm font-medium opacity-90 w-68">
                {overlayCard.title}
              </div>
            )}
            {overlayCol && (
              <div className="w-72 rounded-xl border border-border bg-muted/40 px-3 py-2.5 shadow-lg opacity-90">
                <span className="text-sm font-medium">{overlayCol.name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      {/* New board */}
      <Dialog open={newBoardOpen} onOpenChange={setNewBoardOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New board</DialogTitle></DialogHeader>
          <Input
            autoFocus
            placeholder="Board name"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateBoard() }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBoardOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBoard} disabled={boardSaving || !newBoardName.trim()}>
              {boardSaving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New column */}
      <Dialog open={newColOpen} onOpenChange={setNewColOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New column</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              placeholder="Column name"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateColumn() }}
            />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Color</p>
              <div className="flex flex-wrap gap-2">
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => setNewColColor(c.value)}
                    className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c.value,
                      outline: newColColor === c.value ? `2px solid ${c.value}` : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewColOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateColumn} disabled={colSaving || !newColName.trim()}>
              {colSaving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit column */}
      <Dialog open={editColOpen} onOpenChange={setEditColOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit column</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              value={editColName}
              onChange={(e) => setEditColName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleEditColumn() }}
            />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Color</p>
              <div className="flex flex-wrap gap-2">
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => setEditColColor(c.value)}
                    className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c.value,
                      outline: editColColor === c.value ? `2px solid ${c.value}` : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditColOpen(false)}>Cancel</Button>
            <Button onClick={handleEditColumn} disabled={!editColName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit card */}
      <Dialog open={editCardOpen} onOpenChange={setEditCardOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit card</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              placeholder="Title"
              value={editCardTitle}
              onChange={(e) => setEditCardTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              value={editCardDesc}
              onChange={(e) => setEditCardDesc(e.target.value)}
              className="min-h-24 resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCardOpen(false)}>Cancel</Button>
            <Button onClick={handleEditCard} disabled={!editCardTitle.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
