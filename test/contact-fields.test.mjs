import test from "node:test"
import assert from "node:assert/strict"

import {
  CONTACT_FIELD_GROUPS,
  CONTACT_FIELDS,
  HANDLED_ELSEWHERE,
  isBlank,
} from "../src/lib/contact-fields.js"

/**
 * isBlank decides whether a field renders its value or an em-dash. Getting it
 * wrong is invisible in a build and in a lint run — the page renders, it just
 * renders nothing.
 */

test("isBlank: absent values", () => {
  assert.equal(isBlank(null), true)
  assert.equal(isBlank(undefined), true)
  assert.equal(isBlank(""), true)
  assert.equal(isBlank("   "), true)
  assert.equal(isBlank([]), true)
  assert.equal(isBlank({}), true)
})

test("isBlank: present values, including the falsy ones", () => {
  // 0 and false are values, not blanks. A `value == null || !value` shortcut
  // would swallow both.
  assert.equal(isBlank(0), false)
  assert.equal(isBlank(false), false)
  assert.equal(isBlank("0"), false)
  assert.equal(isBlank("text"), false)
  assert.equal(isBlank([""]), false)
  assert.equal(isBlank({ a: 1 }), false)
})

test("isBlank: a Date is a value, not an empty object", () => {
  // Regression test for a live bug. @neondatabase/serverless returns
  // timestamptz as a Date, and `Object.keys(new Date())` is [], so the generic
  // object branch classified every date as blank. The one kind:"date" field
  // (created_at, labelled "Submitted") rendered as an em-dash for every
  // contact, on both /contacts/[id] and the /data drawer.
  //
  // The red state is removing the `value instanceof Date` branch from isBlank.
  assert.equal(isBlank(new Date()), false)
  assert.equal(isBlank(new Date("2026-05-03T18:31:29.433Z")), false)
  assert.equal(isBlank(new Date(0)), false)
  // An unparseable date genuinely has nothing to render.
  assert.equal(isBlank(new Date("not a date")), true)
})

test("field descriptors are complete", () => {
  for (const field of CONTACT_FIELDS) {
    assert.equal(typeof field.key, "string", "every field needs a key")
    assert.ok(field.key.length > 0)
    assert.equal(typeof field.label, "string", `${field.key} needs a label`)
    assert.ok(field.icon, `${field.key} needs an icon`)
  }
})

test("field keys are unique across groups", () => {
  const keys = CONTACT_FIELDS.map((f) => f.key)
  assert.equal(new Set(keys).size, keys.length, `duplicate key in ${keys.join(", ")}`)
})

test("CONTACT_FIELDS is the flattening of CONTACT_FIELD_GROUPS", () => {
  assert.equal(
    CONTACT_FIELDS.length,
    CONTACT_FIELD_GROUPS.reduce((n, g) => n + g.fields.length, 0)
  )
  for (const group of CONTACT_FIELD_GROUPS) {
    assert.equal(typeof group.title, "string")
    assert.ok(Array.isArray(group.fields) && group.fields.length > 0)
  }
})

test("columns rendered by a dedicated control are not also listed as fields", () => {
  // id, name, status and company_id have their own UI. Listing one here would
  // render it twice — once read-only, once editable.
  for (const key of HANDLED_ELSEWHERE) {
    assert.ok(
      !CONTACT_FIELDS.some((f) => f.key === key),
      `${key} is handled elsewhere but also listed as a field`
    )
  }
})

test("declared kinds are ones ContactFieldValue can render", () => {
  const RENDERABLE = ["text", "url", "date", "array", "json", "longtext"]
  for (const field of CONTACT_FIELDS) {
    if (field.kind === undefined) continue // defaults to text
    assert.ok(
      RENDERABLE.includes(field.kind),
      `${field.key} declares kind "${field.kind}", which ContactFieldValue has no branch for`
    )
  }
})
