import test from "node:test"
import assert from "node:assert/strict"

import {
  RESOLVED_STATUSES,
  isOpen,
  daysSinceTouch,
  needsAttention,
} from "../src/lib/follow-up.js"

/**
 * `needsAttention` feeds both the dashboard's "Needs attention" count and the
 * /data filter. If the two ever computed it differently they would disagree on
 * screen — the mistake EXCLUDED_EMAILS made across nine call sites. One module,
 * so these tests cover both surfaces at once.
 */

test("isOpen: every resolved status closes the lead", () => {
  for (const status of RESOLVED_STATUSES) {
    assert.equal(isOpen({ status }), false, `${status} should not be open`)
  }
})

test("isOpen: anything else is still open", () => {
  for (const status of ["New", "new", "contacted", "quoted", "follow-up", "", null, undefined]) {
    assert.equal(isOpen({ status }), true, `${String(status)} should be open`)
  }
})

test("needsAttention: open and never touched", () => {
  assert.equal(needsAttention({ status: "New", has_touch: false }), true)
  assert.equal(needsAttention({ status: "New", has_touch: undefined }), true)
})

test("needsAttention: touched, or resolved, means no", () => {
  assert.equal(needsAttention({ status: "New", has_touch: true }), false)
  assert.equal(needsAttention({ status: "win", has_touch: false }), false)
  assert.equal(needsAttention({ status: "test", has_touch: false }), false)
})

test("needsAttention: age is deliberately not part of the rule", () => {
  // The red state for this test is re-introducing the staleness threshold that
  // was removed. A lead that arrived seconds ago and has never been worked is
  // flagged; any threshold above zero days would drop it and fail here.
  const justNow = new Date().toISOString()
  const contact = { status: "New", has_touch: false, created_at: justNow, last_touch: null }
  assert.equal(needsAttention(contact), true)

  // ...and an ancient lead that HAS been worked is still not flagged, so the
  // rule keys on the touch, never on the clock.
  const longAgo = new Date(Date.now() - 400 * 86_400_000).toISOString()
  assert.equal(needsAttention({ status: "New", has_touch: true, created_at: longAgo }), false)
})

test("daysSinceTouch: whole days, floored", () => {
  const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString()
  assert.equal(daysSinceTouch({ last_touch: daysAgo(0) }), 0)
  assert.equal(daysSinceTouch({ last_touch: daysAgo(1) }), 1)
  assert.equal(daysSinceTouch({ last_touch: daysAgo(226) }), 226)
})

test("daysSinceTouch: falls back to arrival, then gives up", () => {
  const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString()
  assert.equal(daysSinceTouch({ last_touch: null, created_at: daysAgo(10) }), 10)
  // last_touch wins when both are present.
  assert.equal(daysSinceTouch({ last_touch: daysAgo(2), created_at: daysAgo(10) }), 2)
  assert.equal(daysSinceTouch({ last_touch: null, created_at: null }), null)
  assert.equal(daysSinceTouch({}), null)
})

test("daysSinceTouch: accepts a Date, which is how the driver returns it", () => {
  assert.equal(daysSinceTouch({ last_touch: new Date(Date.now() - 3 * 86_400_000) }), 3)
})
