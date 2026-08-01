/**
 * Deal pipeline stages, defined once.
 *
 * The keys here MUST match the CHECK constraint in
 * db/migrations/002-create-deals.sql. This session already lost a feature to
 * that exact mismatch: contact_activities.type allowed only
 * call/meeting/email/task while the code inserted 'status_change', so every
 * status change threw after updating the row and the table stayed empty for
 * months. scripts/check-constraints.mjs exists so that cannot repeat, and it
 * checks every CHECK constraint rather than only this one.
 */

export const DEAL_STAGES = [
  { key: "qualification", label: "Qualification", color: "#3b82f6", probability: 20 },
  { key: "proposal",      label: "Proposal",      color: "#f97316", probability: 40 },
  { key: "negotiation",   label: "Negotiation",   color: "#a855f7", probability: 70 },
  { key: "won",           label: "Won",           color: "#22c55e", probability: 100 },
  { key: "lost",          label: "Lost",          color: "#ef4444", probability: 0 },
]

export const DEAL_STAGE_KEYS = DEAL_STAGES.map((s) => s.key)

/** Stages that close a deal. Reaching one stamps won_at / lost_at. */
export const CLOSED_STAGES = ["won", "lost"]

export function stageMeta(key) {
  return DEAL_STAGES.find((s) => s.key === key) ?? DEAL_STAGES[0]
}

export function isOpenStage(key) {
  return !CLOSED_STAGES.includes(key)
}

/** Open pipeline value — won and lost deals are excluded. */
export function pipelineValue(deals) {
  return deals
    .filter((d) => isOpenStage(d.stage))
    .reduce((sum, d) => sum + Number(d.value ?? 0), 0)
}

export function formatMoney(value) {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n)
}
