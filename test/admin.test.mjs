import test from "node:test"
import assert from "node:assert/strict"

import { parseAdminEmails, isAdminEmail } from "../src/lib/admin.js"

/**
 * This is the gate in front of every account's email, sign-in history and
 * activity log. The assertion that matters most is the unset case: a list that
 * fails open would hand the whole user table to every signed-in account, and
 * would do it silently — nothing on screen distinguishes "you are the admin"
 * from "the check stopped working".
 */

test("nobody is an admin when the variable is unset, empty or junk", () => {
  for (const raw of [undefined, null, "", "   ", ",", ",,,", " , , "]) {
    assert.equal(
      isAdminEmail("admin@example.com", raw),
      false,
      `${JSON.stringify(raw)} must not grant admin`
    )
  }
})

test("an empty entry does not match a user with no email", () => {
  // A trailing comma used to be the obvious way to produce a set containing "".
  for (const email of [undefined, null, "", "   "]) {
    assert.equal(isAdminEmail(email, "admin@example.com,"), false)
    assert.equal(isAdminEmail(email, ""), false)
  }
})

test("the configured address is an admin", () => {
  assert.equal(isAdminEmail("admin@example.com", "admin@example.com"), true)
})

test("casing and surrounding space do not decide access", () => {
  // The same address reaches this function from Neon Auth, from the environment
  // as a human typed it, and from audit_logs.actor_email. They do not agree.
  const raw = "  Admin@Example.com , second@example.com"
  assert.equal(isAdminEmail("admin@example.com", raw), true)
  assert.equal(isAdminEmail("ADMIN@EXAMPLE.COM", raw), true)
  assert.equal(isAdminEmail(" admin@example.com ", raw), true)
  assert.equal(isAdminEmail("second@example.com", raw), true)
})

test("a non-listed address is not an admin", () => {
  const raw = "admin@example.com"
  for (const email of ["someone@example.com", "admin@other.com", "admin@example.com.evil.com"]) {
    assert.equal(isAdminEmail(email, raw), false, `${email} must not grant admin`)
  }
})

test("matching is exact, not a prefix or substring", () => {
  assert.equal(isAdminEmail("dmin@example.com", "admin@example.com"), false)
  assert.equal(isAdminEmail("admin@example.co", "admin@example.com"), false)
})

test("parseAdminEmails drops blanks and normalises", () => {
  assert.deepEqual(
    [...parseAdminEmails(" A@x.com ,, B@X.COM , ")],
    ["a@x.com", "b@x.com"]
  )
  assert.deepEqual([...parseAdminEmails(undefined)], [])
})
