import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

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
 * The server snapshot is false: there is no viewport during SSR, and the
 * desktop layout is the safer default to send down.
 */
function subscribe(onChange) {
  const query = window.matchMedia(MOBILE_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  )
}
