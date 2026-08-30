import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"

/**
 * Shared DnD sensor setup for the kanban boards (generic, contacts).
 * 5px activation distance so a click doesn't register as a drag.
 */
export function useKanbanSensors() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
}
