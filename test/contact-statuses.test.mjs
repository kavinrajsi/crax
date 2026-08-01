import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  CONTACT_STATUSES,
  CONTACT_STATUS_KEYS,
  RESOLVED_STATUS_KEYS,
  DEFAULT_CONTACT_STATUS,
  isContactStatus,
  statusMeta,
} from "../src/lib/contact-statuses.js"

/**
 * contact_us.status had no CHECK constraint and five drifting copies of its
 * vocabulary. These tests pin the module that replaced them, and the last one
 * pins it against the migration text itself — scripts/check-constraints.mjs
 * compares against db/schema.sql, which is regenerated from the live database
 * and so only agrees after the migration has actually been applied. This closes
 * the window in between.
 */

test("the vocabulary is the seven statuses that exist in production", () => {
  assert.deepEqual(CONTACT_STATUS_KEYS, [
    "New", "follow-up", "win", "closed", "rejected", "fake", "test",
  ])
})

test("resolved statuses are derived from the flag, not maintained by hand", () => {
  // follow-up.js kept this list separately. If the two ever disagreed, the
  // dashboard's "needs attention" count would link to a /data filter returning
  // a different set — the exact failure EXCLUDED_EMAILS produced across nine
  // call sites.
  assert.deepEqual(RESOLVED_STATUS_KEYS, ["win", "closed", "rejected", "fake", "test"])
})

test("New and follow-up are open, so a lead in them still needs work", () => {
  assert.ok(!RESOLVED_STATUS_KEYS.includes("New"))
  assert.ok(!RESOLVED_STATUS_KEYS.includes("follow-up"))
})

test("the default status is inside the vocabulary", () => {
  // A column default outside its own CHECK makes every INSERT that omits the
  // column fail — including both intake paths, which is every lead the CRM
  // receives.
  assert.ok(isContactStatus(DEFAULT_CONTACT_STATUS))
  assert.equal(DEFAULT_CONTACT_STATUS, "New")
})

test("isContactStatus is exact, and case matters", () => {
  for (const key of CONTACT_STATUS_KEYS) assert.ok(isContactStatus(key), key)

  assert.equal(isContactStatus("Contacted"), false)
  // data-page-client.js keyed a badge-variant map on "Closed" while the real
  // status is "closed", so that entry never matched a row. Postgres compares
  // the CHECK case-sensitively; anything looser here would hide that class of
  // bug rather than catch it.
  assert.equal(isContactStatus("Closed"), false)
  assert.equal(isContactStatus("NEW"), false)
  assert.equal(isContactStatus(""), false)
  assert.equal(isContactStatus(undefined), false)
})

test("statusMeta falls back instead of returning undefined", () => {
  assert.equal(statusMeta("win").label, "Win")
  // A row written before the constraint existed must still render a badge
  // rather than throwing on `.label` of undefined and taking the row with it.
  assert.equal(statusMeta("whatever-this-is"), CONTACT_STATUSES[0])
  assert.equal(statusMeta(undefined), CONTACT_STATUSES[0])
})

test("every status carries a distinct key and colour", () => {
  // Two statuses sharing a colour makes the planner unreadable, and a duplicate
  // key would make statusMeta return the wrong one silently.
  assert.equal(new Set(CONTACT_STATUS_KEYS).size, CONTACT_STATUS_KEYS.length)
  const colors = CONTACT_STATUSES.map((s) => s.color)
  assert.equal(new Set(colors).size, colors.length)
  for (const status of CONTACT_STATUSES) {
    assert.match(status.color, /^#[0-9a-f]{6}$/, `${status.key} needs a hex colour`)
    assert.ok(status.label?.length, `${status.key} needs a label`)
  }
})

test("the migration allows exactly these seven values", () => {
  const sql = readFileSync(
    new URL("../db/migrations/004-constrain-contact-status.sql", import.meta.url),
    "utf8"
  )
  const array = sql.match(/ADD CONSTRAINT contact_us_status_check[\s\S]*?ARRAY\[([^\]]*)\]/)
  assert.ok(array, "contact_us_status_check not found in the migration")

  const allowed = [...array[1].matchAll(/'([^']*)'/g)].map((m) => m[1])
  assert.deepEqual(
    allowed,
    CONTACT_STATUS_KEYS,
    "the migration and CONTACT_STATUS_KEYS have drifted"
  )
})
