/**
 * Activity types, defined once.
 *
 * These keys MUST match the contact_activities_type_check CHECK constraint.
 * That constraint is the one that already cost this project a feature: it
 * allowed call/meeting/email/task while updateContactStatus and
 * bulkUpdateStatus always inserted 'status_change', so every status change
 * threw after updating the row and the table sat empty for months. The live
 * constraint was widened to fix it. The guard that compared this list against
 * the constraint was deleted on 2026-08-01, so keeping the two in step is now
 * manual: change this array and contact_activities_type_check together.
 *
 * `system: true` means the app writes it, not a person choosing from a menu.
 * The distinction matters: the dialog must not offer 'status_change', but the
 * constraint must still allow it, so both lists come from here.
 */

export const ACTIVITY_TYPES = [
  { key: "call",          label: "Call" },
  { key: "meeting",       label: "Meeting" },
  { key: "email",         label: "Email" },
  { key: "task",          label: "Task" },
  { key: "status_change", label: "Status change", system: true },
]

/** Every value the column may hold. Compared against the CHECK constraint. */
export const ACTIVITY_TYPE_KEYS = ACTIVITY_TYPES.map((t) => t.key)

/** The subset a user can pick in the Add Activity dialog. */
export const USER_ACTIVITY_TYPES = ACTIVITY_TYPES.filter((t) => !t.system)

export function isActivityType(key) {
  return ACTIVITY_TYPE_KEYS.includes(key)
}
