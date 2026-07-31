"use client"

import { useTransition } from "react"
import {
  PhoneIcon,
  CalendarIcon,
  MailIcon,
  CheckSquareIcon,
  CheckCircleIcon,
  Trash2Icon,
  ArrowRightIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { completeActivity, deleteActivity } from "@/app/(app)/contacts/[id]/actions"
import { timeAgo } from "@/lib/table-utils"

const TYPE_META = {
  call:          { icon: PhoneIcon,       label: "Call",          color: "text-blue-500" },
  meeting:       { icon: CalendarIcon,    label: "Meeting",       color: "text-violet-500" },
  email:         { icon: MailIcon,        label: "Email",         color: "text-orange-500" },
  task:          { icon: CheckSquareIcon, label: "Task",          color: "text-green-500" },
  status_change: { icon: ArrowRightIcon,  label: "Status Change", color: "text-slate-400" },
}

function formatDue(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const diff = d - now
  const days = Math.round(diff / 86400000)
  if (days < 0) return { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/30" }
  if (days === 0) return { label: "Due today", className: "bg-amber-500/10 text-amber-600 border-amber-400/30" }
  if (days === 1) return { label: "Due tomorrow", className: "bg-muted text-muted-foreground" }
  return { label: `Due in ${days}d`, className: "bg-muted text-muted-foreground" }
}


export function ActivityItem({ activity, contactId, onComplete, onDelete }) {
  const [isPending, startTransition] = useTransition()
  const meta = TYPE_META[activity.type] ?? TYPE_META.task
  const Icon = meta.icon
  const due = !activity.completed_at ? formatDue(activity.due_at) : null

  function handleComplete() {
    onComplete?.(activity.id)
    startTransition(() => completeActivity(activity.id, contactId))
  }

  function handleDelete() {
    onDelete?.(activity.id)
    startTransition(() => deleteActivity(activity.id, contactId))
  }

  return (
    <div className={`flex items-start gap-3 ${activity.completed_at ? "opacity-60" : ""}`}>
      {/* Icon */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
          <span className="text-xs font-semibold">{activity.title}</span>
          {activity.completed_at && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
              <CheckCircleIcon className="h-3 w-3 text-green-500" />
              Done
            </Badge>
          )}
          {due && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${due.className}`}>
              {due.label}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{timeAgo(activity.created_at)}</span>
        </div>

        {/* Body */}
        {activity.body && (
          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{activity.body}</p>
        )}

        {/* Actions */}
        {!activity.completed_at && (
          <div className="flex items-center gap-1 mt-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-muted-foreground hover:text-green-600 px-2"
              onClick={handleComplete}
              disabled={isPending}
            >
              <CheckCircleIcon className="h-3 w-3 mr-1" />
              Complete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-muted-foreground hover:text-destructive px-2"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2Icon className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
