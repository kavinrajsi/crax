import test from "node:test"
import assert from "node:assert/strict"

import {
  getValue,
  sortRows,
  formatDate,
  timeAgo,
  truncate,
  sourcePath,
  sourceDomain,
} from "../src/lib/table-utils.js"

/**
 * These helpers existed as up to six near-identical copies that had drifted.
 * The merge kept the union of behaviours; these tests pin that union so the
 * next edit cannot quietly drop one again.
 */

test("getValue: timestamptz arrives as a Date and must sort numerically", () => {
  // The branch under test is `value instanceof Date`, which only one of the
  // original six copies had. Asserted on getValue DIRECTLY, not through
  // sortRows: two Date objects already compare correctly via valueOf, so a
  // sortRows-level test stays green with the branch deleted and would never
  // have been able to fail.
  assert.equal(getValue({ last_touch: new Date(0) }, "last_touch"), 0)
  assert.equal(getValue({ last_touch: new Date(86_400_000) }, "last_touch"), 86_400_000)
  assert.equal(typeof getValue({ last_touch: new Date() }, "last_touch"), "number")
})

test("getValue: null and undefined collapse to the empty string", () => {
  assert.equal(getValue({ a: null }, "a"), "")
  assert.equal(getValue({}, "missing"), "")
})

test("getValue: an ISO-ish string becomes epoch millis", () => {
  assert.equal(getValue({ d: "1970-01-02" }, "d"), 86_400_000)
  // The regex only anchors YYYY-MM-DD, so a trailing time still matches.
  assert.equal(getValue({ d: "1970-01-01T00:00:01Z" }, "d"), 1000)
})

test("getValue: strings are lowercased so sorting is case-insensitive", () => {
  assert.equal(getValue({ n: "Zebra" }, "n"), "zebra")
  // A non-date, non-string value passes through untouched.
  assert.equal(getValue({ n: 42 }, "n"), 42)
  assert.equal(getValue({ n: false }, "n"), false)
})

test("sortRows: ascending and descending, without mutating the input", () => {
  const rows = [{ n: "b" }, { n: "a" }, { n: "c" }]
  const original = [...rows]

  assert.deepEqual(sortRows(rows, "n", "asc").map((r) => r.n), ["a", "b", "c"])
  assert.deepEqual(sortRows(rows, "n", "desc").map((r) => r.n), ["c", "b", "a"])
  assert.deepEqual(rows, original, "sortRows must copy before sorting")
})

test("sortRows: no column means no sort", () => {
  const rows = [{ n: "b" }, { n: "a" }]
  assert.equal(sortRows(rows, null, "asc"), rows)
})

test("sortRows: sorts Date columns chronologically, not lexically", () => {
  const rows = [
    { id: 2, last_touch: new Date("2026-02-01") },
    { id: 1, last_touch: new Date("2026-01-01") },
    { id: 3, last_touch: new Date("2026-03-01") },
  ]
  assert.deepEqual(sortRows(rows, "last_touch", "asc").map((r) => r.id), [1, 2, 3])
})

test("formatDate: blank input renders the em-dash placeholder", () => {
  assert.equal(formatDate(null), "—")
  assert.equal(formatDate(undefined), "—")
  assert.equal(formatDate(""), "—")
})

test("formatDate: compact drops the year, full keeps it, seconds adds a third part", () => {
  // Exact locale output varies with the ICU build, so assert on structure
  // rather than on a literal string.
  const iso = "2026-03-14T09:05:07Z"
  const compact = formatDate(iso, { compact: true })
  const full = formatDate(iso)
  const withSeconds = formatDate(iso, { seconds: true })

  assert.ok(!compact.includes("2026"), `compact should omit the year: ${compact}`)
  assert.ok(full.includes("2026"), `full should include the year: ${full}`)
  assert.ok(
    withSeconds.length > full.length,
    `seconds variant should be longer: ${withSeconds} vs ${full}`
  )
})

test("timeAgo: buckets by minute, hour, then day", () => {
  const ago = (ms) => new Date(Date.now() - ms).toISOString()
  assert.equal(timeAgo(ago(0)), "just now")
  assert.equal(timeAgo(ago(30 * 1000)), "just now")
  assert.equal(timeAgo(ago(5 * 60_000)), "5m ago")
  assert.equal(timeAgo(ago(59 * 60_000)), "59m ago")
  assert.equal(timeAgo(ago(3 * 3_600_000)), "3h ago")
  assert.equal(timeAgo(ago(2 * 86_400_000)), "2d ago")
  assert.equal(timeAgo(null), "")
})

test("truncate: only past the limit, and the ellipsis is one character", () => {
  assert.equal(truncate("short", 20), "short")
  assert.equal(truncate("12345678901234567890", 20), "12345678901234567890")
  assert.equal(truncate("123456789012345678901", 20), "12345678901234567890…")
  assert.equal(truncate("", 20), "—")
  assert.equal(truncate(null), "—")
})

test("sourcePath: hostname plus path, www stripped, trailing slash dropped", () => {
  assert.equal(sourcePath("https://www.example.com/contact/"), "example.com/contact")
  assert.equal(sourcePath("https://example.com/"), "example.com/")
  assert.equal(sourcePath("https://example.com/a/b"), "example.com/a/b")
  // Not a URL — fall back to the raw string rather than throwing.
  assert.equal(sourcePath("not a url"), "not a url")
  assert.equal(sourcePath(""), "—")
})

test("sourceDomain: hostname only, with a caller-supplied fallback", () => {
  assert.equal(sourceDomain("https://www.example.com/deep/path"), "example.com")
  assert.equal(sourceDomain("nonsense"), "nonsense")
  assert.equal(sourceDomain("", "n/a"), "n/a")
})
