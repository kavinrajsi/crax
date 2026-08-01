import test from "node:test"
import assert from "node:assert/strict"

import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_KEYS,
  USER_ACTIVITY_TYPES,
  isActivityType,
} from "../src/lib/activity-types.js"

/**
 * The keys here must equal the contact_activities_type_check CHECK constraint.
 * That agreement is enforced against both db/schema.sql and the live database
 * by scripts/check-constraints.mjs; these tests cover the split between what a
 * user may pick and what the column may hold, which no constraint can express.
 */

test("ACTIVITY_TYPE_KEYS mirrors ACTIVITY_TYPES, in order", () => {
  assert.deepEqual(ACTIVITY_TYPE_KEYS, ACTIVITY_TYPES.map((t) => t.key))
  assert.deepEqual(ACTIVITY_TYPE_KEYS, ["call", "meeting", "email", "task", "status_change"])
})

test("status_change is allowed by the column but never offered in the dialog", () => {
  // The app writes it from updateContactStatus and bulkUpdateStatus; a person
  // choosing "Status change" from a menu would be writing a lie. Dropping it
  // from ACTIVITY_TYPE_KEYS instead is what broke this feature for months.
  assert.ok(ACTIVITY_TYPE_KEYS.includes("status_change"))
  assert.ok(!USER_ACTIVITY_TYPES.some((t) => t.key === "status_change"))
})

test("every user-selectable type is a valid column value", () => {
  for (const type of USER_ACTIVITY_TYPES) {
    assert.ok(ACTIVITY_TYPE_KEYS.includes(type.key), `${type.key} is not an allowed value`)
    assert.equal(typeof type.label, "string")
    assert.ok(type.label.length > 0)
  }
  assert.equal(USER_ACTIVITY_TYPES.length, ACTIVITY_TYPES.filter((t) => !t.system).length)
})

test("isActivityType rejects what the CHECK constraint would reject", () => {
  for (const key of ACTIVITY_TYPE_KEYS) assert.equal(isActivityType(key), true)
  // addActivity is a server action, so `type` is whatever the caller sends.
  // These used to reach Postgres and surface as "Something went wrong".
  for (const key of ["note", "voicemail", "", null, undefined, 0, "CALL"]) {
    assert.equal(isActivityType(key), false, `${String(key)} should be rejected`)
  }
})
