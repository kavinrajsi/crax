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
 * The three pieces are exported separately so they can be tested without a
 * browser. Driving this through a real narrow viewport turned out not to be
 * possible in the automation environment — window.innerWidth stayed pinned at
 * its original value however the window was resized — so the parts are verified
 * directly instead: see test/use-mobile.test.mjs.
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
