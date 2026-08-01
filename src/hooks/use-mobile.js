import * as React from "react"

export const MOBILE_BREAKPOINT = 768
export const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Tracks whether the viewport is phone-width. Used by the sidebar to decide
 * between the docked rail and the slide-over sheet.
 *
 * useSyncExternalStore rather than useState + useEffect. The shadcn original
 * subscribed to the media query and then called setIsMobile in the effect body
 * to seed the first value, which is the one lint error this project had —
 * react-hooks/set-state-in-effect. It also meant the first paint always
 * rendered the desktop layout and then re-rendered, because the initial state
 * was undefined until the effect ran.
 *
 * The three pieces are exported separately so they can be driven without a
 * browser. They were covered by test/use-mobile.test.mjs until 2026-08-01;
 * that test is gone and the CSS breakpoints were never verified in a real
 * browser either, because window.innerWidth stayed pinned at its original value
 * however the automation environment resized the window. Treat the exact
 * breakpoint behaviour as unverified.
 */

/** Subscribes to breakpoint changes. Returns the unsubscribe function. */
export function subscribe(onChange) {
  const query = window.matchMedia(MOBILE_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** Client snapshot: whether the viewport currently matches the query. */
export function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

/**
 * Server snapshot. There is no viewport during SSR, and the desktop layout is
 * the safer default to send down — the mobile branch renders a Sheet, which
 * would mean shipping markup for a closed dialog to every request.
 */
export function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
