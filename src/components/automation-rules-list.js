"use client"

import { useState, useTransition } from "react"
import { PlusIcon, Trash2Icon, ZapIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
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
import { createRule, toggleRule, deleteRule } from "@/app/(app)/automation/actions"

const TRIGGER_OPTIONS = [
  { value: "contact_status_changed", label: "Contact status changed" },
  { value: "contact_created",        label: "New contact created" },
  { value: "activity_completed",     label: "Activity completed" },
]

const CONTACT_STATUSES = ["New", "follow-up", "win", "closed", "rejected", "fake"]

const ACTION_OPTIONS = [
  { value: "create_task",            label: "Create a task" },
  { value: "send_email",             label: "Send an email template" },
  { value: "add_tag",                label: "Add a tag to contact" },
  { value: "update_contact_status",  label: "Update contact status" },
]

const TRIGGER_BADGE_COLORS = {
  contact_status_changed: "bg-blue-500/10 text-blue-600 border-blue-400/30",
  contact_created:        "bg-green-500/10 text-green-600 border-green-400/30",
  activity_completed:     "bg-violet-500/10 text-violet-600 border-violet-400/30",
}

function TriggerLabel({ trigger }) {
  const opt = TRIGGER_OPTIONS.find((o) => o.value === trigger)
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${TRIGGER_BADGE_COLORS[trigger] ?? "bg-muted text-muted-foreground"}`}>
      {opt?.label ?? trigger}
    </span>
  )
}

function ActionLabel({ action }) {
  const opt = ACTION_OPTIONS.find((o) => o.value === action)
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-muted text-muted-foreground">
      {opt?.label ?? action}
    </span>
  )
}

function NewRuleDialog({ templates, onCreated }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [trigger, setTrigger] = useState("contact_status_changed")
  const [filterToStatus, setFilterToStatus] = useState("")
  const [action, setAction] = useState("create_task")
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDays, setTaskDays] = useState("3")
  const [templateId, setTemplateId] = useState("")
  const [tagValue, setTagValue] = useState("")
  const [newStatus, setNewStatus] = useState("follow-up")
  const [isPending, startTransition] = useTransition()

  function buildTriggerFilter() {
    if (trigger === "contact_status_changed" && filterToStatus) return { to_status: filterToStatus }
    return {}
  }

  function buildActionConfig() {
    if (action === "create_task")           return { title: taskTitle, due_days: parseInt(taskDays) || 3 }
    if (action === "send_email")            return { template_id: parseInt(templateId) }
    if (action === "add_tag")               return { tag: tagValue.trim().toLowerCase() }
    if (action === "update_contact_status") return { status: newStatus }
    return {}
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    const fields = {
      name: name.trim(),
      trigger_event:  trigger,
      trigger_filter: buildTriggerFilter(),
      action_type:    action,
      action_config:  buildActionConfig(),
    }
    startTransition(async () => {
      const rule = await createRule(fields)
      onCreated?.(rule)
      setName(""); setTrigger("contact_status_changed"); setFilterToStatus("")
      setFilterToStage(""); setAction("create_task"); setTaskTitle("")
      setTaskDays("3"); setTemplateId(""); setTagValue(""); setNewStatus("follow-up")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-xs">
          <PlusIcon className="h-3.5 w-3.5" />
          New Rule
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Automation Rule</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Rule name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Auto follow-up on new contact" disabled={isPending} required />
          </div>

          {/* Trigger */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">When (trigger)</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Trigger filters */}
          {trigger === "contact_status_changed" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Only when status changes to (optional)</Label>
              <Select value={filterToStatus} onValueChange={setFilterToStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any status</SelectItem>
                  {CONTACT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Action */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Then (action)</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Action config */}
          {action === "create_task" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label className="text-xs">Task title <span className="text-destructive">*</span></Label>
                <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Follow up call" disabled={isPending} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Due in (days)</Label>
                <Input type="number" min="1" value={taskDays} onChange={(e) => setTaskDays(e.target.value)} disabled={isPending} />
              </div>
            </div>
          )}
          {action === "send_email" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Email template <span className="text-destructive">*</span></Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose template…" /></SelectTrigger>
                <SelectContent>
                  {templates.length === 0
                    ? <SelectItem value="" disabled>No templates — create one first</SelectItem>
                    : templates.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
          )}
          {action === "add_tag" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Tag <span className="text-destructive">*</span></Label>
              <Input value={tagValue} onChange={(e) => setTagValue(e.target.value)} placeholder="e.g. hot-lead" disabled={isPending} required />
            </div>
          )}
          {action === "update_contact_status" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Set status to</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTACT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={!name.trim() || isPending}>
              {isPending ? "Creating…" : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AutomationRulesList({ initialRules, templates }) {
  const [rules, setRules] = useState(initialRules)
  const [isPending, startTransition] = useTransition()

  function handleCreated(rule) {
    setRules((prev) => [rule, ...prev])
  }

  function handleToggle(ruleId, current) {
    setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, is_active: !current } : r))
    startTransition(() => toggleRule(ruleId, !current))
  }

  function handleDelete(ruleId) {
    setRules((prev) => prev.filter((r) => r.id !== ruleId))
    startTransition(() => deleteRule(ruleId))
  }

  const activeCount = rules.filter((r) => r.is_active).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{rules.length} rule{rules.length !== 1 ? "s" : ""}</Badge>
          {activeCount > 0 && (
            <Badge className="text-xs gap-1 bg-green-500/10 text-green-700 border border-green-400/30 hover:bg-green-500/10">
              <ZapIcon className="h-3 w-3" />
              {activeCount} active
            </Badge>
          )}
        </div>
        <NewRuleDialog templates={templates} onCreated={handleCreated} />
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <ZapIcon className="h-8 w-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">No automation rules yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a rule to automate repetitive CRM actions.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col rounded-xl border border-border overflow-hidden">
          {rules.map((rule, i) => (
            <div key={rule.id}>
              {i > 0 && <Separator />}
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <p className="text-sm font-medium">{rule.name}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <TriggerLabel trigger={rule.trigger_event} />
                    <span className="text-[10px] text-muted-foreground">→</span>
                    <ActionLabel action={rule.action_type} />
                    {rule.trigger_filter?.to_status && (
                      <span className="text-[10px] text-muted-foreground">to "{rule.trigger_filter.to_status}"</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={() => handleToggle(rule.id, rule.is_active)}
                    disabled={isPending}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(rule.id)}
                    disabled={isPending}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Rules run automatically when their trigger fires. All executions are logged internally.
      </p>
    </div>
  )
}
