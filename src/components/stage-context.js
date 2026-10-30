"use client"

import { createContext, useCallback, useContext } from "react"
import { CONTACT_STATUSES } from "@/lib/contact-statuses"

/*
 * Every pipeline stage in the database, in board order. The (app) layout
 * loads them once per request and provides them here, so any client component
 * can show a custom stage's real label and colour, not just the nine built-in
 * statuses.
 *
 * Without a provider (or before the layout has loaded), the built-in statuses
 * are used. Those are the Leads pipeline's stages, so the fallback is never
 * wrong for Leads.
 */

const StageContext = createContext(null)

export function StageProvider({ stages, children }) {
  return <StageContext.Provider value={stages}>{children}</StageContext.Provider>
}

const FALLBACK = CONTACT_STATUSES.map((s, position) => ({
  key: s.key,
  pipeline_id: 1,
  label: s.label,
  color: s.color,
  position,
  resolved: Boolean(s.resolved),
}))

export function useStages() {
  return useContext(StageContext) ?? FALLBACK
}

/**
 * Same contract as statusMeta(): a null key gets the first stage, so a row with
 * no status still renders a labelled chip. An unknown key gets a grey chip that
 * shows the raw key, rather than borrowing another stage's name and colour.
 */
export function useStatusMeta() {
  const stages = useStages()
  return useCallback(
    (key) => {
      if (key == null) return stages[0] ?? FALLBACK[0]
      return stages.find((s) => s.key === key) ?? { key, label: key, color: "#64748b", resolved: false }
    },
    [stages]
  )
}
