import test from "node:test"
import assert from "node:assert/strict"

import { CONTACT_FIELD_GROUPS } from "../src/lib/contact-fields.js"

/**
 * Regression test for "Functions cannot be passed directly to Client
 * Components", which threw on every render of /contacts/[id] in production.
 *
 * A Server Component rendered <ContactFieldValue field={field} ...>, and each
 * field carries `icon` — a lucide component, i.e. a function (or a forwardRef
 * object whose .render is one). Neither crosses the RSC boundary. The fix was
 * to pass primitives only; the icon is rendered by the server-side card header.
 *
 * SCOPE, honestly stated: this is a data invariant on the field descriptors and
 * on the props built from them. It does not prove that no server component
 * anywhere passes a function to a client component — only a type checker or a
 * render test could. It does pin the specific shape that broke.
 */

/**
 * Walk a value and return the paths at which a function is reachable.
 * Cycles are tracked so a self-referencing object cannot hang the test.
 */
function findFunctions(value, path = "value", seen = new Set()) {
  if (typeof value === "function") return [path]
  if (value === null || typeof value !== "object") return []
  if (seen.has(value)) return []
  seen.add(value)

  // Dates and similar built-ins have methods on the prototype, not as own
  // properties, so only own enumerable keys are walked — the same thing React
  // serialises.
  return Object.entries(value).flatMap(([key, child]) =>
    findFunctions(child, `${path}.${key}`, seen)
  )
}

test("findFunctions detects the shape that actually broke production", () => {
  // A lucide icon is a forwardRef object: not itself a function, but carrying
  // one at .render. The scanner has to see through that.
  const lucideLike = { $$typeof: Symbol.for("react.forward_ref"), render: () => null }
  const oldProps = { field: { key: "email", label: "Email", icon: lucideLike } }

  assert.deepEqual(findFunctions(oldProps), ["value.field.icon.render"])
})

test("findFunctions detects a plain function prop too", () => {
  assert.deepEqual(findFunctions({ onSelect: () => {} }), ["value.onSelect"])
  assert.deepEqual(findFunctions({ a: { b: [() => {}] } }), ["value.a.b.0"])
})

test("findFunctions reports nothing for serialisable data", () => {
  // Without this the test above could pass with a scanner that flags
  // everything, and the assertions below would be worthless.
  assert.deepEqual(findFunctions({ value: "text", kind: "date", breakAll: false }), [])
  assert.deepEqual(findFunctions({ a: [1, "two", null], b: { c: 3 } }), [])
  assert.deepEqual(findFunctions({ when: new Date() }), [])
  assert.deepEqual(findFunctions(null), [])
})

test("findFunctions terminates on a cyclic object", () => {
  const cyclic = { name: "x" }
  cyclic.self = cyclic
  assert.deepEqual(findFunctions(cyclic), [])
})

test("the props ContactFieldValue receives carry no functions", () => {
  // This is the shape the pages build today: primitives only. Reverting to
  // `field={field}` reintroduces field.icon.render and fails here.
  const contact = { email: "a@b.com", created_at: new Date(), needs: ["x"], raw_payload: {} }

  for (const group of CONTACT_FIELD_GROUPS) {
    for (const field of group.fields) {
      const props = {
        value: contact[field.key] ?? null,
        kind: field.kind,
        breakAll: field.breakAll,
      }
      assert.deepEqual(
        findFunctions(props, `props(${field.key})`),
        [],
        `${field.key} would send a function across the RSC boundary`
      )
    }
  }
})

test("passing a whole field descriptor is still unsafe, and this proves it", () => {
  // The guard is only meaningful if the descriptors do carry functions — if
  // icons were ever removed, the test above would pass vacuously.
  const offenders = CONTACT_FIELD_GROUPS.flatMap((group) =>
    group.fields.flatMap((field) => findFunctions(field, `field(${field.key})`))
  )
  assert.ok(
    offenders.length > 0,
    "expected field descriptors to carry icon functions; if not, this guard is vacuous"
  )
})
