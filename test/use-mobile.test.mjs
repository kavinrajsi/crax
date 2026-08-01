import test from "node:test"
import assert from "node:assert/strict"

import {
  MOBILE_BREAKPOINT,
  MOBILE_QUERY,
  subscribe,
  getSnapshot,
  getServerSnapshot,
} from "../src/hooks/use-mobile.js"

/**
 * useIsMobile decides whether the sidebar renders as a docked rail or a
 * slide-over Sheet, so getting it wrong replaces the whole navigation on one
 * class of device — and neither a build nor a lint run can see it.
 *
 * The intent was to exercise this in a real browser at a narrow viewport. That
 * did not work: in the automation environment window.innerWidth stayed pinned
 * at its original value however the window was resized, so the media query
 * never flipped and the component never re-rendered. Rather than claim a check
 * that did not happen, the hook's three parts are driven directly here against
 * a stub matchMedia — which is what the browser would have been exercising
 * anyway, minus the CSS breakpoints themselves.
 */

/** Minimal MediaQueryList stub that records its listeners. */
function stubMatchMedia({ matches }) {
  const listeners = []
  const query = {
    matches,
    addEventListener: (type, fn) => listeners.push([type, fn]),
    removeEventListener: (type, fn) => {
      const i = listeners.findIndex(([t, f]) => t === type && f === fn)
      if (i !== -1) listeners.splice(i, 1)
    },
  }
  const calls = []
  globalThis.window = {
    matchMedia: (q) => {
      calls.push(q)
      return query
    },
  }
  return { listeners, calls, query }
}

test.afterEach(() => {
  delete globalThis.window
})

test("the query is derived from the breakpoint, exclusive of it", () => {
  // 768 is the first desktop pixel, so the mobile query must stop at 767.
  assert.equal(MOBILE_BREAKPOINT, 768)
  assert.equal(MOBILE_QUERY, "(max-width: 767px)")
})

test("client snapshot reports what the media query reports", () => {
  const wide = stubMatchMedia({ matches: false })
  assert.equal(getSnapshot(), false)
  assert.deepEqual(wide.calls, [MOBILE_QUERY], "must query the breakpoint, not something else")

  stubMatchMedia({ matches: true })
  assert.equal(getSnapshot(), true)
})

test("server snapshot is false, so SSR sends the desktop layout", () => {
  // Deliberately does not touch `window` — there is none during SSR, and
  // reading it would throw on every server render.
  assert.equal(getServerSnapshot(), false)
})

test("subscribe registers a change listener and unsubscribing removes it", () => {
  const { listeners } = stubMatchMedia({ matches: false })
  const onChange = () => {}

  const unsubscribe = subscribe(onChange)
  assert.equal(listeners.length, 1, "expected one listener after subscribe")
  assert.deepEqual(listeners[0], ["change", onChange])

  unsubscribe()
  assert.equal(listeners.length, 0, "unsubscribe must remove the listener it added")
})

test("subscribe removes only its own listener", () => {
  // useSyncExternalStore may subscribe more than once across a remount; a
  // cleanup that cleared everything would silently deafen the live one.
  const { listeners } = stubMatchMedia({ matches: false })
  const first = () => {}
  const second = () => {}

  const unsubscribeFirst = subscribe(first)
  subscribe(second)
  assert.equal(listeners.length, 2)

  unsubscribeFirst()
  assert.deepEqual(listeners.map(([, fn]) => fn), [second])
})

test("a change event drives the value React would read next", () => {
  // The pair that matters: the listener fires, and the snapshot read after it
  // returns the new value. That is the whole contract useSyncExternalStore
  // relies on.
  const { listeners, query } = stubMatchMedia({ matches: false })
  let notified = 0
  subscribe(() => notified++)

  assert.equal(getSnapshot(), false)

  query.matches = true
  for (const [, fn] of listeners) fn()

  assert.equal(notified, 1, "React must be told the store changed")
  assert.equal(getSnapshot(), true, "and the value it reads back must be the new one")
})
